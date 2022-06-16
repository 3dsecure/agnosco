# Agnosco - 3dsecure.io

Agnosco is a demo application and testing tool for the 3dsecure.io 3-D Secure
Server.

It is a small web service that should run on your localhost (or somewhere
sufficiently secure if you enter real PANs), then you browse the service to
run a 3-D Secure version 2 flow using a 3-D Secure Server like
`service.3dsecure.io`.


## Usage

### First time setup: DNS

Set up a DNS name resolving to `127.0.0.1`, e.g. in your `/etc/hosts` file:

```
echo '127.0.0.1 agnosco.3dsecure.io' | sudo tee -a /etc/hosts > /dev/null
```

If you do not use `agnosco.3dsecure.io` you will need to create another
certificate than what agnosco comes with.

### First time setup: SSL/TLS certificate

Since
(a) agnosco will run on your localhost and
(b) scheme's Directory Servers (DS) require the `notificationURL` to be HTTPS,
we need to have a certificate configured for localhost. Agnosco comes with a key
and certificate that can be used; it is not signed by a CA
([for good reasons](https://letsencrypt.org/docs/certificates-for-localhost/))
so you either have to trust it (with the potential consequence that anyone can
MiTM you when visiting `agnosco.3dsecure.io`) or generate your own key and
certificate (see below section for the required one-liner) and trust only that.

Import the certificate (no matter what you choose) in your trust store and trust
it for SSL/TLS, either in a specific browser or system-wide.

* On macOS, you can double-click the certificate to import it in Keychain
  Access, and change trust to be "Always Trust" for SSL.

### Start the docker container

```bash
docker run --rm -d -P \
  --name agnosco 3dsecure/agnosco \
  --cert static/agnosco.3dsecure.io-cert.pem \
  --key static/agnosco.3dsecure.io-key.pem \
  -k 'your api key for ...' -u 'https://service.3dsecure.io'

port=$(docker inspect --format='{{(index (index .NetworkSettings.Ports "9398/tcp") 0).HostPort}}' agnosco)

echo "Browse https://agnosco.3dsecure.io:${port}"
```

### 3DSv2 authentication flow

Browse `https://agnosco.3dsecure.io:${port}` as outputted above, replace the
first few values of the presented AReq and press Submit.


## Generating your own key and certificate

The key and certificate was generated using this command:

```bash
bash -c 'openssl req -x509 -out agnosco.3dsecure.io-cert.pem -keyout agnosco.3dsecure.io-key.pem -newkey rsa:2048 -nodes -sha256 -days 358000 -subj "/CN=agnosco.3dsecure.io" -extensions EXT -config <(printf "[dn]\nCN=agnosco.3dsecure.io\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS: agnosco.3dsecure.io\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth")'
```

You can do the same, just don't forget to mount them in when running the docker
image and trust this certificate instead.


## Work in progress

Please note, Agnosco is still a work in progress.

What needs to be done:

- Proper display and interpretation of challenge results
- Handling the final challenge callback
- Prettier input handling
- ...
