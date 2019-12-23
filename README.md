# Agnosco - 3dsecure.io

Agnosco is a demo application and testing tool for the 3dsecure.io 3-D Secure server.

To use it, you have to clone the repository, go to the cloned folder and start it using:

```bash
go run github.com/3dsecure/agnosco/cmd/agnosco -e sandbox -k ${APIKEY}
```

### Work in progress ###

Please note, Agnosco is still a work in progress.

What needs to be done:

- The 3DSMethod has not been implemented
- Proper display and interpretation of challenge results
- Handling the final challenge callback
- ...
