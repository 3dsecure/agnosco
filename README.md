# Agnosco - 3dsecure.io

Agnosco is a demo application and testing tool for the 3dsecure.io 3-D Secure server.

To use it, you have to clone the repository, go to the cloned folder and start it using:

```bash
go run github.com/3dsecure/agnosco/cmd/agnosco -e sandbox -k ${APIKEY}
```

### Setting up for TLS locally

First, set up a DNS name pointing at `127.0.0.1`, e.g. in your `/etc/hosts` file.

If you want to use TLS, you first need to generate new certificates, generate a self-signed
certificate CA and web server certificate.

To generate web server certificate:

```
openssl req -newkey rsa \
  -keyout key.pem -nodes \
  -pkeyopt rsa_keygen_bits:2048 \
  -addext "subjectAltName = DNS:<YOURLOCALHOSTDNSNAME>" \
  -addext "extendedKeyUsage = serverAuth" > csr.pem
```

You should likely also add `YOURLOCALHOSTDNSNAME` as the `CNAME`.

When this is set up, start it as:

```bash
go run github.com/3dsecure/agnosco/cmd/agnosco -e sandbox -k ${APIKEY} --cert cert.pem --key key.pem
```

### Work in progress

Please note, Agnosco is still a work in progress.

What needs to be done:

- The 3DSMethod has not been implemented
- Proper display and interpretation of challenge results
- Handling the final challenge callback
- ...
