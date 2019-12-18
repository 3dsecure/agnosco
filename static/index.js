class Flow {
  constructor(submitBtn) {
    this.btn = submitBtn;
    let self = this;

    submitBtn.addEventListener('click', function() {
      self.submitHandler()
    });

  }

  submitHandler() {
    // 1. Lock form
    document.querySelectorAll('textarea, #submit').forEach(function(el) {
      el.setAttribute('disabled', 'disabled');
    });

    // 2. Add spinner
    let loader = document.createElement('div');
    loader.classList.add('loader');
    document.querySelector('.right').appendChild(loader);

    // 3. Parse form
    let FD = this.createForm();

    // 4. Submit form
    this.submitFormData(FD);

    // 5. Wait for response
    // in responseCallback

    // 6. Create challenge iframe

    // 7. Poll for challenge completion
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
    let obj = JSON.parse(data)

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

  createForm() {
    let input = document.getElementById('input').value;

    let FD = new FormData();
    FD.append('input', input)

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
