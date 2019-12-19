class Flow {
  constructor(submitBtn) {
    this.btn = submitBtn;
    this.displayBox = document.querySelector('.right');
    let self = this;

    submitBtn.addEventListener('click', function() {
      self.submitHandler()
    });

  }

  /*
    SdkTransID string
    NotificationURL  string
    ACSURL           string
  */
  buildCReq(ares) {
    let creq = {
      notificationURL: "http://localhost:8270/missing",
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
    creqInput.value = btoa(creq);

    form.action = url;
    form.target = 'challenge';
    form.method = 'post';
    form.submit();

    //return this.doPost(url, FD);
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
      var trxId = await this.preauthCall(obj);

      // 5. Parse form
      let FD = this.createForm(trxId, obj);

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

      let rreq = this.postCReq(parsed.acsURL, creq);

      // 9. Poll for challenge completion
      this.reset();
    } catch(e) {
      if (typeof e === "string") {
        this.displayError(e);
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

  preauthCall(obj) {
    return new Promise(function(resolve, reject) {
      if (!obj.hasOwnProperty('acctNumber')) {
        reject('Missing acctNumber');
      }

      let req = JSON.stringify({
        "acctNumber": obj.acctNumber
      });

      let FD = new FormData();
      FD.append('input', req);

      let XHR = new XMLHttpRequest();

      XHR.addEventListener('load', function(e) {
        if (XHR.status != 200) {
          console.log("Return code " + XHR.status);
        }

        let preauth;

        try {
          preauth = JSON.parse(XHR.responseText);
        } catch(e) {
          reject(e);
        }

        resolve(preauth.threeDSServerTransID);
      });

      XHR.addEventListener('error', function(e) {
        reject("Request failed");
      });

      XHR.addEventListener('timeout', function(e) {
        reject("Request timed out");
      });

      XHR.open('POST', "/3dsmethod");

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

  createForm(trxID, obj) {
    obj.threeDSServerTransID = trxID;
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
        }

        resolve(XHR.responseText);
      });

      XHR.addEventListener('error', function(e) {
        reject(e);
      });

      XHR.addEventListener('timeout', function(e) {
        reject(e);
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
