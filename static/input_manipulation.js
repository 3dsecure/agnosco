const browserExample = {
  acctNumber: "3000100811113072",
  cardExpiryDate: "1910",
  acquirerBIN: "868491",
  acquirerMerchantID: "mGm6AJZ1YotkJJmOk0fx",
  acquirerCountryCode: "208",
  acquirerCountryCodeSource: "01",
  mcc: "5411",
  merchantCountryCode: "840",
  merchantName: "Dummy Merchant",
  messageType: "AReq",
  messageVersion: "2.3.1",
  messageCategory: "01",
  deviceChannel: "02",
  transType: "01",
  threeDSRequestorAuthenticationInd: "01",
  threeDSRequestorID: "az0123456789",
  threeDSRequestorName: "Example Requestor name",
  threeDSRequestorURL: "https://threedsrequestor.adomainname.net",
  purchaseAmount: "101",
  purchaseCurrency: "840",
  purchaseExponent: "2",
  cardholderName: "Cardholder Name",
  email: "example@example.com",
  mobilePhone: { cc: "123", subscriber: "123456789" },
  billAddrCity: "Bill City Name",
  billAddrCountry: "840",
  billAddrLine1: "Bill Address Line 1",
  billAddrPostCode: "Bill Post Code",
  billAddrState: "CO",
  shipAddrCity: "Ship City Name",
  shipAddrCountry: "840",
  shipAddrLine1: "Ship Address Line 1",
  shipAddrPostCode: "Ship Post Code",
  shipAddrState: "CO"
};

// 3RI (3DS Requestor Initiated), deviceChannel "03". Frictionless only: no
// browser fields, no threeDSRequestorAuthenticationInd. acquirerCountryCode /
// acquirerCountryCodeSource are required at 2.3.1. The PAN's last-4 ("3003")
// encodes version 2.3.1 + frictionless-Full; the sandbox panel rewrites it.
const threeRIExample = {
  acctNumber: "5500000000003003",
  cardExpiryDate: "1910",
  acquirerBIN: "868491",
  acquirerMerchantID: "mGm6AJZ1YotkJJmOk0fx",
  acquirerCountryCode: "208",
  acquirerCountryCodeSource: "01",
  mcc: "5411",
  merchantCountryCode: "840",
  merchantName: "Dummy Merchant",
  messageType: "AReq",
  messageVersion: "2.3.1",
  messageCategory: "02",
  deviceChannel: "03",
  threeRIInd: "03",
  threeDSRequestorID: "az0123456789",
  threeDSRequestorName: "Example Requestor name",
  threeDSRequestorURL: "https://threedsrequestor.example.org",
  cardholderName: "Cardholder Name",
  email: "example@example.com",
  billAddrCity: "Bill City Name",
  billAddrCountry: "840",
  billAddrLine1: "Bill Address Line 1",
  billAddrPostCode: "Bill Post Code",
  billAddrState: "CO"
};

function loadExample(name) {
  jsonInput = name === "3ri" ? threeRIExample : browserExample;
  setTextArea();
  updatePanelForChannel();
}

// updatePanelForChannel disables the sandbox controls that are invalid for a
// frictionless 3RI request (deviceChannel "03"): the 3DS-method column, the
// challenge-flow column, and the "I" ARes-status button.
function updatePanelForChannel() {
  let is3RI = false;
  try {
    is3RI = JSON.parse(document.getElementsByName('areq')[0].value).deviceChannel === "03";
  } catch (e) {
    is3RI = false;
  }

  document.querySelectorAll('[data-3ri-disabled]').forEach(function(btn) {
    btn.disabled = is3RI;
  });
}

function init() {
  loadExample("browser");
  document.getElementsByName('areq')[0]
    .addEventListener('input', updatePanelForChannel);
}

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
  if (status < '7') {
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
