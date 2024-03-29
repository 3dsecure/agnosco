package main

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io/ioutil"
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"gopkg.in/alecthomas/kingpin.v2"
)

var (
	port = kingpin.
		Flag("port", "TCP port to listen to").
		Short('p').
		Default("9398").
		Int()

	apiKey = kingpin.
		Flag("apikey", "3dsecure.io API key").
		Short('k').
		String()

	url = kingpin.
		Flag("url", "3dsecure.io host to use").
		Short('u').Default("https://service.sandbox.3dsecure.io").
		String()

	tlsCert = kingpin.
		Flag("cert", "TLS Certificate to use for HTTPS").
		String()

	tlsKey = kingpin.
		Flag("key", "TLS key to use for HTTPS").
		String()

	threeDSMethodMap = sync.Map{}
)

type threeDSMethodCompletion struct {
	ThreeDSServerTransID string
	Time                 time.Time
}

// APIMethod represents the possible API methods for 3dsecure.io
type APIMethod int

const (
	// MethodPreAuth is the /preauth 3dsecure.io API method
	MethodPreAuth APIMethod = iota

	// MethodAuth is the /auth 3dsecure.io API method
	MethodAuth

	// MethodPostAuth is the /postauth 3dsecure.io API method
	MethodPostAuth
)

func main() {
	var e error

	kingpin.Parse()

	gin.SetMode(gin.ReleaseMode)

	router := gin.Default()

	// Host e.g. static css and javascript files.
	router.Static("static", "static/")

	// Load our HTML templates.
	router.LoadHTMLGlob("templates/*")

	router.GET("/", indexHandler)
	router.POST("/submit", submitHandler)

	router.POST("/preauth", preauthMethodHandler)

	router.GET("/3dsmethod/wait", threeDSMethodWaitHandler)
	router.POST("/3dsmethod/end", threeDSMethodEndHandler)

	router.POST("/challenge/end", challengeEndHandler)

	address := fmt.Sprintf("0.0.0.0:%d", *port)

	if *tlsCert != "" && *tlsKey != "" {
		startTLS(router, address)
	} else {
		fmt.Printf("Connect to http://%s\n", address)
		e = router.Run(address)
	}

	fmt.Printf("Error running webserver: %s\n", e.Error())
}

func startTLS(router *gin.Engine, address string) (e error) {
	names, e := getDNSSAN(*tlsCert)
	if e != nil {
		return
	}

	portString := strconv.Itoa(*port)
	for _, name := range names {
		fmt.Printf("Connect to https://%s\n", net.JoinHostPort(name, portString))
	}
	e = router.RunTLS(
		address,
		*tlsCert,
		*tlsKey,
	)

	return
}

func indexHandler(ctx *gin.Context) {
	// Use the templates loaded into the router.
	ctx.HTML(http.StatusOK, "index.tmpl", nil)
}

func preauthMethodHandler(ctx *gin.Context) {
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

func threeDSMethodWaitHandler(ctx *gin.Context) {
	threeDSServerTransID, _ := ctx.GetQuery("threeDSServerTransID")
	if threeDSServerTransID == "" {
		log.Println("Missing threeDSServerTransID in request")
		ctx.Status(http.StatusBadRequest)
		return
	}

	_, ok := threeDSMethodMap.Load(threeDSServerTransID)
	if !ok {
		ctx.String(http.StatusOK, "false")
	} else {
		ctx.String(http.StatusOK, "true")
	}
}

func threeDSMethodEndHandler(ctx *gin.Context) {
	input, ok := ctx.GetPostForm("threeDSMethodData")
	if !ok {
		log.Println("Invalid request, form key threeDSMethodData not present")
		ctx.Status(http.StatusBadRequest)
		return
	}

	inputJSON, e := base64.RawURLEncoding.DecodeString(strings.TrimRight(input, "="))
	if e != nil {
		log.Printf("Invalid threeDSMethodData: %s", e.Error())
		ctx.Status(http.StatusBadRequest)
		return
	}

	data := struct {
		ThreeDSServerTransID string `json:"threeDSServerTransID"`
	}{}

	json.Unmarshal(inputJSON, &data)

	compInd := threeDSMethodCompletion{
		data.ThreeDSServerTransID,
		time.Now(),
	}

	threeDSMethodMap.Store(data.ThreeDSServerTransID, compInd)
}

func submitHandler(ctx *gin.Context) {
	input, ok := ctx.GetPostForm("input")
	if !ok {
		ctx.Status(http.StatusBadRequest)
		return
	}

	m := make(map[string]interface{})

	e := json.Unmarshal([]byte(input), &m)
	if e != nil {
		ctx.String(http.StatusInternalServerError, e.Error())
	}

	ip, _, _ := net.SplitHostPort(ctx.Request.RemoteAddr)
	m["browserIP"] = ip
	m["browserAcceptHeader"] = ctx.Request.Header.Get("Accept")
	m["purchaseDate"] = time.Now().Format("20060102150405")

	inputBytes, _ := json.Marshal(m)

	body, e := apiCall(MethodAuth, string(inputBytes))
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

	cresJSON, e := base64.RawURLEncoding.DecodeString(strings.TrimRight(cresB64, "="))
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
	if !ok {
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
	if contains([]string{"Y", "A", "N"}, transStatus) {
		rreq, e = fetchRReq(threeDSServerTransID)
		if e != nil {
			output["Erro"] = fmt.Sprintf("Error fetching RReq: %s", e.Error())
		} else {

			rreqMap := make(map[string]interface{})
			e = json.Unmarshal(rreq, &rreqMap)
			if e != nil {
				panic(e.Error())
			}

			output["RReq"] = rreqMap
		}

		fmt.Printf("%s\n", rreq)
	}

	ctx.JSON(http.StatusOK, output)
	// 3. Notify of success, somehow.
}

func edssURL(method APIMethod) (base string) {
	switch method {
	case MethodPreAuth:
		base = *url + "/preauth"
	case MethodAuth:
		base = *url + "/auth"
	case MethodPostAuth:
		base = *url + "/postauth"
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

	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				MinVersion: tls.VersionTLS12,
			},
		},
	}
	resp, e := client.Do(req)
	if e != nil {
		return
	}
	defer resp.Body.Close()

	respBody, e := ioutil.ReadAll(resp.Body)
	if e != nil {
		return
	}

	if resp.StatusCode != 200 {
		e = fmt.Errorf("invalid response code %d from 3dsecure.io: %s", resp.StatusCode, respBody)
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

func getDNSSAN(filename string) (dnsNames []string, e error) {
	certPEM, e := ioutil.ReadFile(filename)
	if e != nil {
		return
	}

	block, _ := pem.Decode(certPEM)

	cert, e := x509.ParseCertificate(block.Bytes)

	dnsNames = cert.DNSNames

	return
}
