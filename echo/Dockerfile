# https://github.com/prometheus/alertmanager/blob/master/examples/webhook/echo.go
FROM golang:1.10

WORKDIR $GOPATH/src/app
COPY . .
RUN go get -d -v ./...
RUN go install -v ./...
EXPOSE 5001
CMD ["/go/bin/app"]

