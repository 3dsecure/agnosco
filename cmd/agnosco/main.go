package main

import (
	"encoding/base64"
	"encoding/json"

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
	// MethodPreAuth is the /preauth 3dsecure.io API method
	MethodPreAuth APIMethod = iota

	// MethodAuth is the /preauth 3dsecure.io API method
	MethodAuth

	// MethodPostAuth is the /preauth 3dsecure.io API method
	MethodPostAuth
)

func main() {
	kingpin.Parse()

	gin.SetMode(gin.ReleaseMode)

	router := gin.Default()

	// Host e.g. static css and javascript files.
	router.Static("static", "static/")

	// Load our HTML templates.
	router.LoadHTMLGlob("templates/*")

	router.GET("/", indexHandler)
	router.POST("/submit", submitHandler)
	router.POST("/3dsmethod", threeDSMethodHandler)
	router.POST("/endchallenge", challengeEndHandler)

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
		return
	}

	body, e := apiCall(MethodPreAuth, input)
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
		return
	}

	body, e := apiCall(MethodAuth, input)
	if e != nil {
		ctx.String(http.StatusInternalServerError, e.Error())
	} else {
		ctx.String(http.StatusOK, body)
	}
}

func challengeEndHandler(ctx *gin.Context) {
	var output = make(map[string]interface{})

	// 1. Receive final CRes
	cresB64, ok := ctx.GetPostForm("cres")
	if !ok {
		// TODO: An error should be returned.
		ctx.String(http.StatusBadRequest, "No cres in post form")
		return
	}

	cresJSON, e := base64.RawURLEncoding.DecodeString(cresB64)
	if e != nil {
		ctx.String(http.StatusBadRequest, "Invalid cres Base64 %s", e.Error())
		return
	}

	// 2. If not error: Fetch RReq from EDSS
	M := make(map[string]interface{})
	e = json.Unmarshal(cresJSON, &M)
	if e != nil {
		ctx.String(http.StatusBadRequest, "Invalid cres JSON: %s", e.Error())
		return
	}

	messageType, ok := getString(M, "messageType")
	if e != nil {
		ctx.String(http.StatusBadRequest, "No messageType in returned JSON: %s", cresJSON)
		return
	}

	switch messageType {
	case "Erro":
		output["Erro"] = M
		ctx.JSON(http.StatusOK, output)
		return
	case "CRes":
		output["CRes"] = M
	default:
		ctx.String(http.StatusBadRequest, "Unexpected messageType: %s", cresJSON)
		return
	}

	threeDSServerTransID, ok := getString(M, "threeDSServerTransID")
	if e != nil {
		ctx.String(http.StatusBadRequest, "Expected threeDSServerTransID: %s", cresJSON)
		return
	}

	// From now on we can redirect to the correct listener, if the ID is valid.

	transStatus, ok := getString(M, "transStatus")
	if e != nil {
		ctx.String(http.StatusBadRequest, "Expected transStatus: %s", cresJSON)
		return
	}

	var rreq []byte
	if contains([]string{"Y", "A"}, transStatus) {
		rreq, e = fetchRReq(threeDSServerTransID)
		if e != nil {
			output["Erro"] = fmt.Sprintf("Error fetching RReq: %s", e.Error())
		} else {
			output["RReq"] = rreq
		}

		fmt.Printf("%s\n", rreq)
	}

	ctx.JSON(http.StatusOK, output)
	// 3. Notify of success, somehow.
}

func edssURL(method APIMethod) (base string) {
	if *env == "production" {
		base = "https://service.3dsecure.io"
	} else {
		base = fmt.Sprintf("https://service.%s.3dsecure.io", *env)
	}

	switch method {
	case MethodPreAuth:
		base += "/preauth"
	case MethodAuth:
		base += "/auth"
	case MethodPostAuth:
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

func fetchRReq(threeDSServerTransID string) (rreq []byte, e error) {
	inputStruct := struct {
		ThreeDSServerTransID string `json:"threeDSServerTransID"`
	}{
		threeDSServerTransID,
	}

	input, _ := json.Marshal(inputStruct)

	response, e := apiCall(MethodPostAuth, string(input))
	rreq = []byte(response)

	return
}

func getString(M map[string]interface{}, key string) (val string, ok bool) {
	T, ok := M[key]
	if !ok {
		return
	}

	val, ok = T.(string)

	return
}

func contains(list []string, value string) bool {
	for _, el := range list {
		if el == value {
			return true
		}
	}

	return false
}
