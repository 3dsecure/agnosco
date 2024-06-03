/*
 * TODO:
 *  - Set threeDSCompInd
 *  - Progress checklist
 *  - Error styling
 *  - Challenge window styling
 */

function base64URL(string) {
  str = btoa(string).
        replaceAll('+', '-').
        replaceAll('/', '_').
        replaceAll('=', '');

  return str;
}

class XHRError extends Error {
  constructor(message, details) {
    super(message);

    this.name = 'XHRError';
    this.details = details;
  }
}

class Flow {
  constructor(submitBtn) {
    this.btn = submitBtn;
    this.displayBox = document.querySelector('.right');
    let self = this;

    submitBtn.addEventListener('click', function() {
      self.submitHandler()
    });

  }

  async submitHandler() {
    // 0. Reset display element.
    while (this.displayBox.firstChild) {
      this.displayBox.removeChild(this.displayBox.firstChild);
    }

    // 1. Lock form
    document.querySelectorAll('textarea, #submit').forEach(function(el) {
      el.setAttribute('disabled', 'disabled');
    });

    // 2. Add spinner to indicate loading
    let loader = document.createElement('div');
    loader.classList.add('loader');
    document.querySelector('.right').appendChild(loader);

    // 3. Parse the input early, complain if not JSON.
    let input = document.getElementById('input').value;
    try {
      var obj = JSON.parse(input);
    } catch(e) {
      // TODO: Display error
      this.displayError("Invalid JSON: " + e.message);
      this.reset();
      return;
    }

    try {
      // 4. Perform 3DS Method
      let carddata = await this.preauthCall(obj);
      console.log("CRD:", carddata);

      let trxId = carddata.threeDSServerTransID;

      let threeDSCompInd = "U";
      if (carddata.hasOwnProperty('threeDSMethodURL')) {
        this.do3DSMethod(trxId, carddata.threeDSMethodURL);

        // Wait for threeDSMethodNotificationURL to be called.
        threeDSCompInd = await this.waitFor3DSMethod(trxId);
      }

      // 5. Parse form
      let FD = this.createForm(trxId, threeDSCompInd, obj);

      // 6. Submit form
      let response = await this.submitFormData(FD);

      // 7. Handle response
      let parsed = this.parseAuthResponse(response);
      if (!parsed.hasOwnProperty('transStatus') || parsed.transStatus != "C") {
        this.reset();
        document.querySelector('.right')
          .appendChild(this.prettyJSON(parsed));
        return;
      }

      // 8. Create challenge iframe
      let creq = this.buildCReq(parsed);
      // Convert https to http if url contains secure.localhost
      //if (parsed.acsURL.includes('secure.localhost')) {
      //#  console.log("Converting to http");
      //parsed.acsURL = parsed.acsURL.replace('https', 'http');
      //}
      console.log("ACS:", parsed.acsURL);
      console.log("CReq:", creq);
      this.postCReq(parsed.acsURL, creq);

      // 9. Poll for challenge completion
      this.reset();
    } catch(e) {
      if (typeof e === "string") {
        this.displayError(e);
      } else if (e instanceof XHRError) {
        this.setError(e.message, e.details);
      } else {
        // Object? SyntaxError?
        if (e.hasOwnProperty('message')) {
          this.displayError(e.message);
        } else {
          this.displayError(e);
          console.log(e);
        }
      }

      this.reset();
      return
    }
  }

  clearMessages() {
    while (this.displayBox.firstChild) {
      this.displayBox.removeChild(this.displayBox.firstChild);
    }
  }

  setError(message, details) {
    let container = document.createElement('div');
    container.classList.add('errorcontainer');

    let messageDiv = document.createElement('div');
    messageDiv.classList.add('errormessage');
    let messageNode = document.createTextNode(message);
    messageDiv.appendChild(messageNode);

    let detailsDiv = document.createElement('div')
    detailsDiv.classList.add('errordetails');
    let detailsNode = document.createTextNode(details);
    detailsDiv.appendChild(detailsNode);

    container.appendChild(messageDiv);
    container.appendChild(detailsDiv);

    this.clearMessages();
    this.displayBox.appendChild(container);
  }

  /*
    SdkTransID string
    NotificationURL  string
    ACSURL           string
  */
  buildCReq(ares) {
    let creq = {
      threeDSServerTransID: ares.threeDSServerTransID,
      acsTransID: ares.acsTransID,
      dsTransID: ares.dsTransID,
      messageVersion: ares.messageVersion,
      messageType: "CReq",
      challengeWindowSize: "01"
    };

    return JSON.stringify(creq);
  }

  postCReq(url, creq) {
    let iframe = document.createElement('iframe');
    iframe.setAttribute('width', '250');
    iframe.setAttribute('height', '400');
    iframe.name = "challenge";

    this.displayBox.appendChild(iframe);

    let form = document.getElementById('challengeForm');
    let creqInput = document.getElementById('creq');
    creqInput.value = base64URL(creq);

    form.action = url;
    form.target = 'challenge';
    form.method = 'post';
    form.submit();
  }

  displayError(msg) {
    let div = document.createElement('div');
    div.classList.add('error');
    let text = document.createTextNode(msg);
    div.appendChild(text);

    while (this.displayBox.firstChild) {
      this.displayBox.removeChild(this.displayBox.firstChild);
    }

    this.displayBox.appendChild(div);
  }

  displayJSON(msg) {
    div.appendChild(text);
  }

  preauthCall(obj) {
    return new Promise(function(resolve, reject) {
      if (!obj.hasOwnProperty('acctNumber')) {
        reject('Missing acctNumber');
        return
      }
      var req_json = { "acctNumber": obj.acctNumber };

      if (obj.hasOwnProperty('ds')) {
        req_json.ds = obj.ds;
      }

      let req = JSON.stringify(req_json);

      let FD = new FormData();
      FD.append('input', req);

      let XHR = new XMLHttpRequest();

      XHR.addEventListener('load', function(e) {
        if (XHR.status != 200) {
          reject(
            new XHRError("Return code " + XHR.status, XHR.responseText)
          );
          return
        }

        let preauth;

        try {
          preauth = JSON.parse(XHR.responseText);
        } catch(e) {
          reject(e);
          return
        }

        if (preauth.hasOwnProperty('messageType') && preauth.messageType == 'Erro') {
          reject(
            new XHRError("Return code " + XHR.status, XHR.responseText)
          );
        }

        resolve(preauth);
        return
      });

      XHR.addEventListener('error', function(e) {
        reject("Request failed");
        return
      });

      XHR.addEventListener('timeout', function(e) {
        reject("Request timed out");
        return
      });

      XHR.open('POST', "/preauth");

      XHR.send(FD);
    });
  }

  doPost(url, FD) {
    return new Promise(function(resolve, reject) {
      let XHR = new XMLHttpRequest();

      XHR.addEventListener('load', function(e) {
        if (XHR.status != 200) {
          reject(new Error(
            "Invalid response code " + XHR.status + ": " + XHR.responseText)
          );
          return
        }

        resolve(XHR.responseText);
        return
      });

      XHR.addEventListener('error', function(e) {
        reject(e);
        return
      });

      XHR.addEventListener('timeout', function(e) {
        reject(e);
        return
      });

      XHR.open('POST', url);

      XHR.send(FD);
    });
  }

  prettyJSON(input) {
    let string = JSON.stringify(input, null, '  ');
    let pre = document.createElement('pre');

    let code = document.createElement('code');
    code.classList.add('json');

    let text = document.createTextNode(string);

    code.appendChild(text);
    pre.appendChild(code);

    hljs.highlightBlock(pre);

    return pre;
  }

  parseAuthResponse(data) {
    try {
      var obj = JSON.parse(data)
    } catch (e) {
      throw new Error("Invalid JSON received: " + e.message);
    }

    if (!obj.hasOwnProperty('messageType')) {
      throw new Error("Invalid object received, no messageType key");
    }

    return obj;
  }

  do3DSMethod(threeDSServerTransID, threeDSMethodURL) {
    let iframe = document.createElement('iframe');
    iframe.name = "threeDSMethod";
    iframe.height = "0";
    iframe.width = "0";
    this.displayBox.appendChild(iframe);

    let url = new URL(window.location.origin);
    url.pathname = '/3dsmethod/end';

    let payload = base64URL(JSON.stringify({
      threeDSServerTransID: threeDSServerTransID,
      threeDSMethodNotificationURL: url.toString()
    }));

    let input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'threeDSMethodData';
    input.value = payload;


    let form = document.createElement('form');

    form.method = 'post';
    form.target = 'threeDSMethod';
    form.action = threeDSMethodURL;

    form.appendChild(input);

    this.displayBox.appendChild(form);

    form.submit();
  }

  async waitFor3DSMethod(threeDSServerTransID) {
    let start = Date.now()
    await this.sleep(1000);

    for (let i = 1000; i < 10000; i += 1000) {
      let resp = await this.pollFor3DSMethodCompletion(threeDSServerTransID);
      if (resp == "true") {
        return "Y";
      }

      await this.sleep(1000);
    }

    return "N";
  }

  async pollFor3DSMethodCompletion(threeDSServerTransID) {
    return new Promise(function(resolve, reject) {
      let XHR = new XMLHttpRequest();

      XHR.addEventListener('load', function() {
        if (XHR.status != 200) {
          reject(new Error(
            "Invalid response code " + XHR.status + ": " + XHR.responseText
          ));
          return;
        }

        resolve(XHR.responseText);
        return;
      });

      XHR.addEventListener('error', function(e) {
        reject(e);
        return
      });

      XHR.addEventListener('timeout', function(e) {
        reject(e);
        return
      });

      let url = new URL(window.location.origin);
      url.pathname = '/3dsmethod/wait';
      url.searchParams.set('threeDSServerTransID', threeDSServerTransID);
      XHR.open('GET', url);
      XHR.send();
    });
  }

  async sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
  }


  createForm(trxID, threeDSCompInd, obj) {
    obj.threeDSServerTransID = trxID;
    obj.threeDSCompInd = threeDSCompInd;

    obj.browserJavaEnabled = navigator.javaEnabled()
    obj.browserJavascriptEnabled = true
    obj.browserLanguage = navigator.language
    obj.browserColorDepth = screen.colorDepth.toString()
    obj.browserScreenHeight = screen.height.toString()
    obj.browserScreenWidth = screen.width.toString()
    obj.browserTZ = new Date().getTimezoneOffset().toString()
    obj.browserUserAgent = navigator.userAgent

    let url = new URL(window.location.origin);
    url.pathname = '/challenge/end';
    obj.notificationURL = url.toString();

    let asString = JSON.stringify(obj);
    let FD = new FormData();

    FD.append('input', asString)

    return FD
  }

  submitFormData(FD) {
    let self = this;
    return new Promise(function(resolve, reject) {
      let XHR = new XMLHttpRequest();

      XHR.addEventListener('load', function(e) {
        if (XHR.status != 200) {
          reject(new Error("Invalid response code " + XHR.status + ": " + XHR.responseText));
          return
        }

        resolve(XHR.responseText);
        return
      });

      XHR.addEventListener('error', function(e) {
        reject(e);
        return
      });

      XHR.addEventListener('timeout', function(e) {
        reject(e);
        return
      });

      XHR.open('POST', "/submit");

      XHR.send(FD);
    });
  }

  reset() {
    document.querySelectorAll('textarea, #submit').forEach(function(el) {
      el.removeAttribute('disabled');
    });

    let loader = document.querySelector('.loader')
    if (loader) {
      loader.remove();
    }
  }
}

window.addEventListener("load", function() {
  submitBtn = document.querySelector('#submit');

  new Flow(submitBtn);
});
