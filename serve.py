"""LAN HTTPS installer. Private keys are outside public/ and never served."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler, BaseHTTPRequestHandler
from urllib.parse import urlsplit, unquote
from datetime import datetime, timedelta, timezone
import argparse, base64, hashlib, ipaddress, json, socket, ssl, threading

ROOT=Path(__file__).resolve().parent
PUBLIC=ROOT/'public'
PRIVATE=ROOT/'.local'

def certificates(address):
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID
        from cryptography.hazmat.primitives import serialization, hashes
        from cryptography.hazmat.primitives.asymmetric import rsa
    except ImportError:
        raise SystemExit('Missing dependency. Run: python -m pip install cryptography')
    PRIVATE.mkdir(exist_ok=True)
    now=datetime.now(timezone.utc)
    ca_key_path=PRIVATE/'root-key.pem'; ca_path=PRIVATE/'root-ca.pem'
    if ca_path.exists() and ca_key_path.exists():
        ca=x509.load_pem_x509_certificate(ca_path.read_bytes())
        ca_key=serialization.load_pem_private_key(ca_key_path.read_bytes(),password=None)
    else:
        ca_key=rsa.generate_private_key(public_exponent=65537,key_size=3072)
        name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'Lanyu Local PWA Root')])
        ca=(x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(ca_key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(days=1)).not_valid_after(now+timedelta(days=3650)).add_extension(x509.BasicConstraints(ca=True,path_length=0),critical=True).add_extension(x509.KeyUsage(digital_signature=True,key_encipherment=False,content_commitment=False,data_encipherment=False,key_agreement=False,key_cert_sign=True,crl_sign=True,encipher_only=None,decipher_only=None),critical=True).sign(ca_key,hashes.SHA256()))
        ca_key_path.write_bytes(ca_key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
        ca_path.write_bytes(ca.public_bytes(serialization.Encoding.PEM))
    cert_path=PRIVATE/'server.pem';key_path=PRIVATE/'server-key.pem'
    regenerate=True
    if cert_path.exists() and key_path.exists():
        try:
            old=x509.load_pem_x509_certificate(cert_path.read_bytes())
            regenerate=ipaddress.ip_address(address) not in old.extensions.get_extension_for_class(x509.SubjectAlternativeName).value.get_values_for_type(x509.IPAddress) or old.not_valid_after_utc<now+timedelta(days=7)
        except Exception:pass
    if regenerate:
        key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
        sans=[x509.IPAddress(ipaddress.ip_address(address)),x509.IPAddress(ipaddress.ip_address('127.0.0.1')),x509.DNSName('localhost')]
        cert=(x509.CertificateBuilder().subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'Lanyu Local PWA')])).issuer_name(ca.subject).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(days=1)).not_valid_after(now+timedelta(days=365)).add_extension(x509.SubjectAlternativeName(sans),critical=False).add_extension(x509.BasicConstraints(ca=False,path_length=None),critical=True).add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]),critical=False).add_extension(x509.KeyUsage(digital_signature=True,key_encipherment=True,content_commitment=False,data_encipherment=False,key_agreement=False,key_cert_sign=False,crl_sign=False,encipher_only=None,decipher_only=None),critical=True).sign(ca_key,hashes.SHA256()))
        cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
        key_path.write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
    ca_der=ca.public_bytes(serialization.Encoding.DER)
    (PRIVATE/'lanyu-root.cer').write_bytes(ca_der)
    cert=x509.load_pem_x509_certificate(cert_path.read_bytes())
    spki=base64.b64encode(hashlib.sha256(cert.public_key().public_bytes(serialization.Encoding.DER,serialization.PublicFormat.SubjectPublicKeyInfo)).digest()).decode()
    (PRIVATE/'status.json').write_text(json.dumps({'address':address,'spki':spki,'ca_sha256':hashlib.sha256(ca_der).hexdigest()}),'utf-8')
    return cert_path,key_path

class AppHandler(SimpleHTTPRequestHandler):
    extensions_map={**SimpleHTTPRequestHandler.extensions_map,'.js':'application/javascript','.webmanifest':'application/manifest+json'}
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(PUBLIC),**kw)
    def do_GET(self):
        path=unquote(urlsplit(self.path).path)
        resolved=(PUBLIC/path.lstrip('/')).resolve()
        if not resolved.is_relative_to(PUBLIC.resolve()) or any(part.startswith('.') for part in Path(path).parts if part not in ['/']):
            self.send_error(403);return
        super().do_GET()
    def list_directory(self,path):self.send_error(403);return None
    def end_headers(self):
        self.send_header('Cache-Control','no-cache')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Service-Worker-Allowed','/')
        super().end_headers()

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--ip');parser.add_argument('--prepare',action='store_true');args=parser.parse_args()
    address=args.ip
    if not address:
        sock=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
        try:sock.connect(('192.0.2.1',80));address=sock.getsockname()[0]
        except OSError:address='127.0.0.1'
        finally:sock.close()
    ipaddress.ip_address(address)
    cert,key=certificates(address)
    if args.prepare:print('Certificates ready');return
    app_url=f'https://{address}:8443/'
    class SetupHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            if urlsplit(self.path).path=='/lanyu-root.cer':
                body=(PRIVATE/'lanyu-root.cer').read_bytes();mime='application/x-x509-ca-cert'
            elif urlsplit(self.path).path=='/':
                fingerprint=json.loads((PRIVATE/'status.json').read_text('utf-8'))['ca_sha256']
                body=f'''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>蓝屿安装</title><body style="font:17px/1.8 -apple-system,sans-serif;padding:24px;background:#e5f1fa;color:#233e55"><h1>蓝屿记账</h1><p>首次安装，完成后即可离线使用。</p><p>① <a href="/lanyu-root.cer">下载本机生成的根证书</a></p><p>② 设置 → 通用 → VPN 与设备管理，安装已下载的证书。</p><p>③ 设置 → 通用 → 关于本机 → 证书信任设置，启用 Lanyu Local PWA Root 的完全信任。</p><p>④ <a href="{app_url}">打开蓝屿记账</a>，点右上角设置，确认“离线已就绪”，再从 Safari 分享菜单选择“添加到主屏幕”。</p><p>⑤ 从主屏幕打开一次，在设置中确认离线已就绪，再关闭电脑、开启飞行模式测试。</p><p style="font-size:12px;overflow-wrap:anywhere">证书 SHA-256：{fingerprint}</p></body>'''.encode();mime='text/html; charset=utf-8'
            else:self.send_error(404);return
            self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    https=ThreadingHTTPServer(('0.0.0.0',8443),AppHandler)
    context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);context.minimum_version=ssl.TLSVersion.TLSv1_2;context.load_cert_chain(cert,key);https.socket=context.wrap_socket(https.socket,server_side=True)
    setup=ThreadingHTTPServer(('0.0.0.0',8080),SetupHandler)
    threading.Thread(target=setup.serve_forever,daemon=True).start()
    print(f'Install: http://{address}:8080/',flush=True);print(f'App: {app_url}',flush=True)
    print('No Windows trust store or firewall settings were changed. Ctrl+C stops the servers.',flush=True)
    try:https.serve_forever()
    except KeyboardInterrupt:pass
    finally:https.server_close();setup.shutdown();setup.server_close()
if __name__=='__main__':main()
