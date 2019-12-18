class Flow {
  constructor(submitBtn) {
    this.btn = submitBtn;
    let self = this;

    submitBtn.addEventListener('click', function() {
      self.submitHandler()
    });

  }

  async submitHandler() {
    // 1. Lock form
    document.querySelectorAll('textarea, #submit').forEach(function(el) {
      el.setAttribute('disabled', 'disabled');
    });

    // 2. Add spinner
    let loader = document.createElement('div');
    loader.classList.add('loader');
    document.querySelector('.right').appendChild(loader);

    // 3. Perform 3DS Method
    try {
      var trxId = await this.preauthCall();
      console.log(trxId);
    } catch(e) {
      if (e instanceof SyntaxError) {
        console.log("Invalid input JSON");
      } else {
        console.log(e);
      }
      this.reset();
      return
    }

    // 4. Parse form
    let FD = this.createForm(trxId);

    // 5. Submit form
    this.submitFormData(FD);

    // 6. Wait for response
    // in responseCallback

    // 7. Create challenge iframe

    // 8. Poll for challenge completion
  }

  preauthCall() {
    return new Promise(function(resolve, reject) {
      let input = document.getElementById('input').value;
      try {
        var obj = JSON.parse(input);
      } catch(e) {
        reject('Invalid JSON input');
      }

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

  responseCallback(data) {
    // TODO: Catch error
    try {
      var obj = JSON.parse(data)
    } catch (e) {
      console.log("Invalid JSON received");
      this.reset();
      return
    }

    if (!obj.hasOwnProperty('messageType')) {
      console.log("Invalid object received");
      this.reset();
      return
    }

    if (obj.messageType == "Erro") {
      // TODO: Display error
      console.log(obj.errorDetail);
      document.querySelector('.right').appendChild(this.prettyJSON(obj));
      this.reset();
      return
    }

    // TODO: Remove this?
    document.querySelector('.right').appendChild(this.prettyJSON(obj));
    this.reset();
  }

  createForm(trxID) {
    let input = document.getElementById('input').value;

    let obj = JSON.parse(input);
    obj.threeDSServerTransID = trxID;
    let asString = JSON.stringify(obj);
    let FD = new FormData();

    FD.append('input', asString)

    return FD
  }

  submitFormData(FD) {
    let XHR = new XMLHttpRequest();
    let self = this;

    XHR.addEventListener('load', function(e) {
      if (XHR.status != 200) {
        console.log("Return code " + XHR.status);
        self.reset();
      }

      self.responseCallback(XHR.responseText);
    });

    XHR.addEventListener('error', function(e) {
      console.log("Request failed");
      self.reset();
    });

    XHR.addEventListener('timeout', function(e) {
      console.log("Request timed out");
      self.reset();
    });

    XHR.open('POST', "/submit");

    XHR.send(FD);
  }

  reset() {
    console.log("Resetting form");
    document.querySelectorAll('textarea, #submit').forEach(function(el) {
      el.removeAttribute('disabled');
    });

    document.querySelector('.loader').remove();
  }
}

window.addEventListener("load", function() {
  submitBtn = document.querySelector('#submit');

  new Flow(submitBtn);
});
