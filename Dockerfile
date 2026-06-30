FROM golang:1.26.4
WORKDIR /opt
COPY . .
EXPOSE 9398
ENTRYPOINT ["go", "run", "github.com/3dsecure/agnosco/cmd/agnosco"]
