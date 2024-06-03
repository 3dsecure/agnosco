const process = require('process');
let jsonInput = {}

function setVersion(version) {
  parseInput();
  acctNumber = jsonInput.acctNumber;
  acctNumber = acctNumber.slice(0, -4) + version + acctNumber.slice(-3);
  jsonInput.acctNumber = acctNumber;
  setTextArea();
}

function set3DSMethod(method) {
  parseInput();
  acctNumber = jsonInput.acctNumber;
  acctNumber = acctNumber.slice(0, -3) + method + acctNumber.slice(-2);
  jsonInput.acctNumber = acctNumber;
  setTextArea();
}

function setAresStatus(status) {
  parseInput();
  acctNumber = jsonInput.acctNumber;
  acctNumber = acctNumber.slice(0, -2) + status + acctNumber.slice(-1);
  jsonInput.acctNumber = acctNumber;
  setTextArea();
  if (status < 7) {
    setChallengeFlowOutcome('3');
  }
}

function setChallengeFlowOutcome(outcome) {
  parseInput();
  acctNumber = jsonInput.acctNumber;
  acctNumber = acctNumber.slice(0, -1) + outcome;
  jsonInput.acctNumber = acctNumber;
  setTextArea();
  if (outcome < '3') {
    setAresStatus('7');
  }
}

function parseInput() {
  var textarea = document.getElementsByName('areq')[0];
  try {
    jsonInput = JSON.parse(textarea.value);
  } catch (e) {
    alert('Invalid JSON format');
    return;
  }
}

function setTextArea() {
  var textarea = document.getElementsByName('areq')[0];
  textarea.value = JSON.stringify(jsonInput, null, 2);
}

function prettifyJson() {
  console.log(process.env.url);
  parseInput();
  setTextArea();
}

