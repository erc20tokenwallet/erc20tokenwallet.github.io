var account;
var contract;

const CONTRACT_STRING = '0x278194af0f8DcAaa16660Df9a94DF5689d7b1344';

$(document).ready(init);

function init() {
  $('#blockexplorer').attr('href', 'https://etherscan.io/token/' + CONTRACT_STRING);
  var metaMaskChecker = setInterval(function() {
    if (typeof web3 == 'undefined') {
      var dlLink = '';
      switch(getBrowser()) {
        case 'Chrome':
          dlLink = 'https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn?hl=en';
          break;
        case 'Firefox':
          dlLink = 'https://addons.mozilla.org/en-US/firefox/addon/ether-metamask/';
          break;
        case 'Opera':
          dlLink = 'https://addons.opera.com/en/extensions/details/metamask/';
          break;
      }
      $('#dl-mm').attr('href', dlLink);
      if (dlLink == '')
        switchPage('wrong-browser');
      else
        switchPage('no-metamask');
    } else if (web3.eth.accounts.length == 0)
      switchPage('not-logged-in');
    else
      switchPage('wallet');
  },500);
  web3.version.getNetwork(function(err, netId) {
    switch (netId) {
      case '1':
        console.log('mainnet');
        break;
      case '2':
        console.log('deprecated Morden testnet');
        break;
      case '3':
        console.log('ropsten testnet');
        break;
      case '4':
        console.log('Rinkeby testnet');
        break;
      case '42':
        console.log('Kovan testnet');
        break;
      default:
        console.log('unknown network');
    }
  });
  getMetaMask();
}

function getMetaMask() {
  getAcc(function(acc) {
    account = acc;
  });
  getABI(function(abi) {
    contract = getContract(abi,CONTRACT_STRING);
  });
  var checker = setInterval(function() {
    if (typeof contract != 'undefined') {
      if (typeof account != 'undefined') {
        $('#wallet').show();
        startApp(account);
        clearInterval(checker);
      }
    }
  }, 100);
}

function processBlocks(blockNumberStart, blockNumberEnd) {
  for (var i = blockNumberStart; i <= blockNumberEnd; i++) {
    web3.eth.getBlock(i, true, function(err, block) {
      if (block != null && block.transactions != null) {
        block.transactions.forEach( function(tx) {
          txObj = { hash: tx.hash, date: block.timestamp };

          if (tx.to.toLowerCase() === CONTRACT_STRING.toLowerCase()) {
            web3.eth.getTransactionReceipt(tx.hash, function(err, receipt) {
              txObj.value = web3.toDecimal(receipt.logs[0].data);
              txObj.unit = 'EUR';

              if (tx.from == account) {
                txObj.eventType = 'Sent';
                txObj.address = no0s(receipt.logs[0].topics[2]);
              } else {
                txObj.eventType = 'Received';
                txObj.address = no0s(receipt.logs[0].topics[1]);
              }

              addTx(txObj);
            });
          } else if (account == tx.from || account == tx.to) {
            txObj.eventType = account == tx.from ? 'Sent' : 'Received';
            txObj.address = account == tx.from ? tx.to : tx.from;
            txObj.value =  web3.fromWei(web3.toDecimal(tx.value));
            txObj.unit = 'ETH';

            addTx(txObj);
          }
        });
      }
    });
  }
}

function startApp(account) {
  $('#send').click(function() {
    sendTokens($('#txAddress').val(), $('#txAmount').val());
  });

  setBalance();
  setInterval(setBalance, 5000);

  var lastProcessedBlockNumber;

  web3.eth.getBlockNumber(function(err, blockNumber) {
    processBlocks(blockNumber - 500, blockNumber);

    lastProcessedBlockNumber = blockNumber;

    setInterval(function(){
      web3.eth.getBlockNumber(function(err, blockNumber) {
        if (blockNumber > lastProcessedBlockNumber) {
          processBlocks(lastProcessedBlockNumber + 1, blockNumber);
          lastProcessedBlockNumber = blockNumber;
        }
      });
    }, 2000);
  });

  $('#eth-address').html(account);
  $('#qr-address').attr('src', 'https://chart.googleapis.com/chart?cht=qr&chl=' + account + '&chs=235x235&chld=L|0')
}

function sendTokens(to,amount) {
  contract.transfer(to,amount * 100, function(err, res) {
    var txChecker = setInterval(function() {
      web3.eth.getTransactionReceipt(String(res), function(e,r) {
        setBalance();
        if (r)
          clearInterval(txChecker);
      });
    },100)
  });
}

function setBalance() {
  getBalance(account, function(b) {
    $('#balance').html(l(b));
  })
}

function accountLink(address) {
  return '<a href="http://explorer.psico.exchange/account.html?hash=' + address + '">' + address + '</a>';
}

function amountLink(hash, amount, unit) {
  return '<a href="http://explorer.psico.exchange/tx.html?hash=' + hash + '">' + amount + ' ' + unit + '</a>';
}

function addTx(tx) {
  var trHtml = '<tr>';
  trHtml += '<td><b>' + (tx.eventType == 'Received' ? 'From' : 'To') + ': </b>' + accountLink(tx.address) + '</td>';
  trHtml += '<td>' + amountLink(tx.hash, tx.value, tx.unit)  + '</td>';
  trHtml += '<td>' + date(tx.date * 1000) + '</td>';
  trHtml += '</tr>';

  $('#txList').append(trHtml);
}

function no0s(add) {
  a = add.replace('0x', '');
  while(!web3.isAddress('0x'+a)) {
    a = a.substr(1);
    if (add.length == 0)
      return null;
  }
  return '0x'+a;
}

function date(unix) {
  var d = new Date(unix);
  return d.getMonth()+'/'+d.getDate()+'/'+d.getFullYear()+', '+d.getHours()+':'+d.getMinutes()+':'+d.getSeconds();
}

function getBalance(acc, callback) {
  contract.balanceOf(acc, function(err, res) {
    callback(res.c[0]);
  });
}

function getContract(abi, add) {
  return web3.eth.contract(abi).at(add);
}

function getABI(callback) {
  $.getJSON('/abi.json', callback);
}

function getAcc(callback) {
  var accInt = setInterval(function() {
    var acc = web3.eth.accounts[0];
    if (acc) {
      callback(acc);
      clearInterval(accInt);
    }
  }, 100);
}

function switchPage(id) {
  $('#wallet').hide();
  $('#no-metamask').hide();
  $('#not-logged-in').hide();
  $('#wrong-browser').hide();
  $('#'+id).show();
}

function getBrowser() {
  if (typeof InstallTrigger !== 'undefined')
    return 'Firefox';
  if ((!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0)
    return 'Opera';
  if (/constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || (typeof safari !== 'undefined' && safari.pushNotification)))
    return 'Safari';
  if (/*@cc_on!@*/false || !!document.documentMode)
    return 'Internet Explorer'
  if (!(/*@cc_on!@*/false || !!document.documentMode) && !!window.StyleMedia)
    return 'Edge';
  if (!!window.chrome && !!window.chrome.webstore)
    return 'Chrome';
  return '';
}

function l(inp) {
  return commas(inp/100);
}

function commas(inp) {
  return String(inp).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}
