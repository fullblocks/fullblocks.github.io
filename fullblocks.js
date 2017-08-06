$(function () {
  var cutoffEnd = time();
  var cutoffStart = cutoffEnd - (60 * 60 * 24);

  var stats = {
    legacy: createStats(1 * 1000 * 1000),
    cash: createStats(8 * 1000 * 1000)
  };

  var formatters = {
    bytes: formatBytes,
    number: formatNumber,
    time: formatTime
  };

  function createStats(size) {
    return {
      blocklimit: size,
      blocks: 0,
      txs: 0,
      size: 0,
      usage: 0,
      oldest: Infinity, newest: -Infinity
    };
  }

  function updateStats(s, info) {
    s.blocks += 1;
    s.size += Math.floor(info.size);
    s.txs += Math.floor(info.txs);
    s.oldest = Math.min(s.oldest, info.time);
    s.newest = Math.max(s.newest, info.time);
    s.timespan = s.newest - s.oldest;
    s.tps = Number(s.txs / s.timespan).toFixed(2);
    s.usage = percent(s.size, s.blocks * s.blocklimit);
  }

  function formatBytes(bytes) {
    var kb = bytes / 1000;
    var mb = kb / 1000;
    return [mb.toFixed(2), 'MB'].join(' ');
  }

  function formatNumber(x) {
    return Number(x).toLocaleString();
  }

  function formatTime(x) {
    return String(new Date(x * 1000));
  }

  function showStats(chain) {
    $('[data-' + chain + ']').each(function (i, node) {
      var key = $(node).data(chain);
      var format = $(node).data('format');
      var value = stats[chain][key];
      var f = formatters[format];
      if (f) { value = f(value); }
      $(node).text(value);
    });
  }

  function cashrpc(method, params) {
    var defer = $.Deferred(), request = {
      method: method,
      params: params
    };

    $.post('https://hashes.download/api', request).done(function (response) {
      if (response && ('result' in response)) {
        defer.resolve(response.result);
      } else {
        defer.reject(response.error || "Unknown error");
      }
    }).fail(defer.reject);

    return defer.promise();
  }

  function legacyrpc(method, params) {
    params = params || {};
    params.format = 'json';
    params.cors = true;
    return $.get('https://blockchain.info/' + String(method), params);
  }

  function fetchLegacyChain() {
    var ms = (cutoffEnd * 1000);

    legacyrpc('blocks/' + String(ms)).then(function (response) {
      console.log("Legacy block list", response.blocks);
      var stack = response.blocks;
      var latest = stack.pop();
      fetchLegacyBlock(latest.hash, stack);
    });
  }

  function fetchLegacyBlock(hash, stack) {
    if (hash in localStorage) {
      updateLegacyBlock(JSON.parse(localStorage[hash]), stack);
      return;
    }

    legacyrpc('rawblock/' + hash).then(function (block) {
      updateLegacyBlock(block, stack);
    });
  }

  function updateLegacyBlock(block, stack) {
    var info = {
      size: block.size,
      txs: block.n_tx,
      time: block.time
    };

    delete block.tx;
    localStorage[block.hash] = JSON.stringify(block);
    console.log("Legacy block", info);

    updateStats(stats.legacy, info);
    showStats('legacy');
    if (stack.length <= 0) { return; }
    var next = stack.pop();
    fetchLegacyBlock(next.hash, stack);
  }

  function time() {
    return (Date.now() / 1000) | 0;
  }

  function percent(x, max) {
    var p = (x / max) * 100.0;
    return String(p.toFixed(2)) + '%';
  }

  function fetchCashChain() {
    cashrpc('getblockcount').then(function (latest) {
      console.log("Cash block height is", latest);

      cashrpc('getblockhash', [latest]).then(function (hash) {
        console.log("Latest cash block is ", hash);
        fetchCashBlock(hash);
      });
    });
  }

  function fetchCashBlock(hash) {
    if (hash in localStorage) {
      updateCashBlock(JSON.parse(localStorage[hash]));
      return;
    }

    cashrpc('getblock', [hash]).then(updateCashBlock);
  }

  function updateCashBlock(block) {
    console.log("Cash block", block);
    if (block.time < cutoffStart) { return; }
    localStorage[block.hash] = JSON.stringify(block);
    updateStats(stats.cash, {size: block.size, txs: block.tx.length, time: block.time});
    showStats('cash');
    fetchCashBlock(block.previousblockhash);
  }

  fetchCashChain();
  fetchLegacyChain();
});
