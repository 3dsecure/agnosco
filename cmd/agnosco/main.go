package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"gopkg.in/alecthomas/kingpin.v2"
)

var (
	port   = kingpin.Flag("port", "TCP port to listen to").Short('p').Default("9398").Int()
	apiKey = kingpin.Flag("apikey", "3dsecure.io API key").Short('k').String()

	env = kingpin.Flag("env", "3dsecure.io environment to use").Short('e').Default("sandbox").String()
)

func main() {
	kingpin.Parse()

	router := gin.Default()
	router.GET("/", indexHandler)
	router.POST("/submit", submitHandler)
	router.Static("static", "static/")

	router.LoadHTMLGlob("templates/*")

	address := fmt.Sprintf("localhost:%d", *port)
	fmt.Printf("Connect to http://%s\n", address)

	router.Run(address)
}

func indexHandler(ctx *gin.Context) {
	ctx.HTML(http.StatusOK, "index.tmpl", nil)
}

func submitHandler(ctx *gin.Context) {
	input, ok := ctx.GetPostForm("input")
	if !ok {
		ctx.Status(http.StatusBadRequest)
	}

	body, e := sendInput(input)
	if e != nil {
		ctx.String(http.StatusInternalServerError, e.Error())
	} else {
		ctx.String(http.StatusOK, body)
	}
}

func sendInput(input string) (response string, e error) {
	body := strings.NewReader(input)

	req, e := http.NewRequest("POST", edssAuthURL(), body)
	if e != nil {
		return
	}

	req.Header.Add("Content-Type", "application/json; charset=utf-8")
	req.Header.Add("APIKey", *apiKey)

	resp, e := http.DefaultClient.Do(req)
	if e != nil {
		return
	}
	defer resp.Body.Close()

	respBody, e := ioutil.ReadAll(resp.Body)
	if e != nil {
		return
	}

	response = string(respBody)

	return
}

func edssAuthURL() string {
	if *env == "production" {
		return "https://service.3dsecure.io/auth"
	}

	return fmt.Sprintf("https://service.%s.3dsecure.io/auth", *env)
}
