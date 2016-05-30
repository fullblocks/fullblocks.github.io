$(function () {
  var maxBlockSize = 1000 * 1000;
  var minTransactions = 10;
  var maxBlockCount = 6 * 12;
  var totalSize = 0;
  var totalTxCount = 0;
  var txRate = 0;
  var averageSize = 0;
  var blockCount = 0;
  var percentFull = 0;
  var emptyBlocks = 0;
  var groupSize = 20;

  if (localStorage && localStorage.maxBlockCount > 0) {
    maxBlockCount = Number(localStorage.maxBlockCount) || (6 * 12);
  }

  function handleError(msg) {
    alert(msg);
  }

  function addBlock(block) {
    blockCount++;
    totalSize += Number(block.size);
    totalTxCount += Number(block.nb_txs);

    calculateAverage();
    calculatePercentage();
    calculateTxRate();
    updateStats();
  }

  function updateChain() {
    fetchData('last', function (last) {
      if (!last) { return handleError("Can't download first block"); }
      var oldest = last.nb;

      function tick() {
        fetchMultiple(oldest, groupSize, function (blocks) {
          blocks.forEach(function (block) {
            oldest = Math.min(oldest, block.nb);
            receiveBlock(block);
          });

          if (oldest > last.nb - maxBlockCount) {
            setTimeout(tick, 333);
          }
        });
      }

      tick();
    });
  }

  function fetchMultiple(start, count, f) {
    var more = [];

    for (var i=0; i < count; i++) {
      more.push(String(start - 1 - i));
    }

    fetchData(more, f);
  }

  function fetchData(x, f) {
    if ($.isArray(x)) {
      x = x.join(",");
    } else {
      x = String(x);
    }

    return $.ajax({
      url: "https://btc.blockr.io/api/v1/block/info/" + x,
      success: function (response) {
        if (!response || response.status !== 'success') {
          f();
          return;
        }

        f(response.data);
      }
    });
  }

  function receiveBlock(block) {
    if (!block) {
      console.log(block);
      return handleError("Unable to fetch latest block");
    }

    if (block.nb_txs >= minTransactions) {
      addBlock(block);
    } else {
      addEmptyBlock();
    }
  }

  function calculateAverage() {
    averageSize = 0;
    if (blockCount <= 0) { return; }
    averageSize = totalSize / blockCount;
  }

  function calculatePercentage() {
    percentFull = Math.round((averageSize / maxBlockSize) * 100);
  }

  function calculateTxRate() {
    if (blockCount <= 0) { totalTxCount = 0; }
    txRate = Math.round(totalTxCount / blockCount / 10 / 60);
  }

  function labelPercentage() {
    return String(percentFull) + "%";
  }

  function labelTime() {
    var hours = Math.round(blockCount * 10 / 60);
    return "Last " + String(hours) + " hours";
  }

  function labelBlockCount() {
    return (String(blockCount) + " blocks " + labelEmptyBlockCount()).trim();
  }

  function labelEmptyBlockCount() {
    return (emptyBlocks > 0) ? ("(" + String(emptyBlocks) + " empty)") : "";
  }

  function labelSize() {
    var kb = Math.round(averageSize / 1000);
    return String(kb) + " KB";
  }

  function labelTxRate() {
    return String(txRate) + " tx/s";
  }

  function labelStats() {
    return [
      labelTime(),
      labelBlockCount(),
      labelSize(),
      labelTxRate()
    ].join(' - ');
  }

  function updateStats() {
    $('#percent').text(labelPercentage());
    $('#stats').text(labelStats());
  }

  function addEmptyBlock() {
    blockCount++;
    emptyBlocks++;
    updateStats();
  }

  function resetStats() {
    window.location = 'index.html';
  }

  function changeHistorySize(x) {
    localStorage.maxBlockCount = x;
    window.location = 'index.html';
  }

  $('#reset').click(function () { resetStats(); });
  $('#size6h').click(function () { changeHistorySize(6 * 6); });
  $('#size12h').click(function () { changeHistorySize(6 * 12); });
  $('#size24h').click(function () { changeHistorySize(6 * 24); });
  $('#size48h').click(function () { changeHistorySize(6 * 48); });

  updateChain();
});
