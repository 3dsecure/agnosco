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

// APIMethod represents the possible API methods for 3dsecure.io
type APIMethod int

const (
	// PreAuth is the /preauth 3dsecure.io API method
	PreAuth APIMethod = iota

	// Auth is the /preauth 3dsecure.io API method
	Auth

	// PostAuth is the /preauth 3dsecure.io API method
	PostAuth
)

func main() {
	kingpin.Parse()

	router := gin.Default()

	// Host e.g. static css and javascript files.
	router.Static("static", "static/")

	// Load our HTML templates.
	router.LoadHTMLGlob("templates/*")

	router.GET("/", indexHandler)
	router.POST("/submit", submitHandler)
	router.POST("/3dsmethod", threeDSMethodHandler)

	address := fmt.Sprintf("localhost:%d", *port)
	fmt.Printf("Connect to http://%s\n", address)

	router.Run(address)
}

func indexHandler(ctx *gin.Context) {
	// Use the templates loaded into the router.
	ctx.HTML(http.StatusOK, "index.tmpl", nil)
}

func threeDSMethodHandler(ctx *gin.Context) {
	input, ok := ctx.GetPostForm("input")
	if !ok {
		ctx.Status(http.StatusBadRequest)
	}

	body, e := apiCall(PreAuth, input)
	if e != nil {
		ctx.String(http.StatusInternalServerError, e.Error())
	} else {
		ctx.String(http.StatusOK, body)
	}
}

func submitHandler(ctx *gin.Context) {
	input, ok := ctx.GetPostForm("input")
	if !ok {
		ctx.Status(http.StatusBadRequest)
	}

	body, e := apiCall(Auth, input)
	if e != nil {
		ctx.String(http.StatusInternalServerError, e.Error())
	} else {
		ctx.String(http.StatusOK, body)
	}
}

func edssURL(method APIMethod) (base string) {
	if *env == "production" {
		base = "https://service.3dsecure.io"
	} else {
		base = fmt.Sprintf("https://service.%s.3dsecure.io", *env)
	}

	switch method {
	case PreAuth:
		base += "/preauth"
	case Auth:
		base += "/auth"
	case PostAuth:
		base += "/postauth"
	}

	return
}

func apiCall(method APIMethod, input string) (response string, e error) {
	body := strings.NewReader(input)

	req, e := http.NewRequest("POST", edssURL(method), body)
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

	if resp.StatusCode != 200 {
		e = fmt.Errorf("Invalid response code %d from 3dsecure.io: %s", resp.StatusCode, respBody)
		return
	}

	response = string(respBody)

	return
}
