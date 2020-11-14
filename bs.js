(function(){
    var index_ord = [
        "預金・現金・仮想通貨",
        "ポイント",
        "投資信託",
        "債券",
        "その他の資産",

        "キャッシング・カードローン",
        "クレジットカード利用残高",
        "その他",
        ];

    function update_chart() {
        var req;
        var dbh;
        var chart;
        var lastdate = '';
        var lia = {};
        var lia_cats = {};
        var lia_dur = "";
        var lia_ids_cat = {};
        var lia_date_cat_bals = {};
        var lia_ids = [];
        var lia_id;

        var x_drawAssetTimeSeriesTrendChart = function (cat,ser) {
            var xa = dbh.transaction(["lia_bals"], "readwrite");
            var bals = xa.objectStore("lia_bals");

            var i, j;
            for (j = 0; j < ser.length; ++j) {
                if (ser[j]["name"] == "負債") {
                    for (i = 0; i < cat.length; ++i) {
                        bals.put({date:cat[i], id:lia_id, bal:ser[j]["data"][i]});
                    }
                    lastdate = cat[cat.length - 2];
                }
            }
        }

        eval("var drawAssetTimeSeriesTrendChart=" + x_drawAssetTimeSeriesTrendChart.name);
        eval("var drawAssetTimeSeriesTrendChart=" + x_drawAssetTimeSeriesTrendChart.name);

        function render_bals() {
            var xa = dbh.transaction(["lia_accts"], "readonly");
            var accts = xa.objectStore("lia_accts");
            var getreq = accts.getAll();
            getreq.onsuccess = function (evt) {
                var i;
                var result = evt.target.result;
                for (i = 0; i < result.length; ++i) {
                    var id = result[i]["id"];
                    var cat = result[i]["cat"];
                    lia_ids_cat[id] = cat;
                    lia_cats[cat] = 1;
                }

                var xa = dbh.transaction(["lia_bals"], "readonly");
                var bals = xa.objectStore("lia_bals");
                var getreq = bals.getAll();
                getreq.onsuccess = function (evt) {
                    var i;
                    var result = evt.target.result;
                    for (i = 0; i < result.length; ++i) {
                        var d = result[i]["date"];
                        var c = lia_ids_cat[result[i]["id"]];
                        var b = result[i]["bal"];
                        if (!(d in lia_date_cat_bals)) lia_date_cat_bals[d] = {};
                        if (!(c in lia_date_cat_bals[d])) lia_date_cat_bals[d][c] = 0;
                        lia_date_cat_bals[d][c] += b;
                    }

                    var cat;
                    var cats = chart.get().categories;
                    var sers = chart.get().series;
                    var bsdata = [];
                    var j;
                    for (j = 0; j < cats.length; ++j) {
                        var bl = 0;
                        for (i = 0; i < sers.length; ++i) {
                            bl += sers[i]["options"]["data"][j];
                        }
                        bsdata[j] = bl;
                    }

                    for (cat in lia_cats) {
                        var data = [];
                        for (j = 0; j < cats.length; ++j) {
                            var bal = lia_date_cat_bals[cats[j]][cat];
                            if (typeof(bal) == "undefined") bal = 0;
                            data.push(bal);
                            bsdata[j] += bal;
                        }

                        var param = {
                            "name": cat,
                            "data": data,
                            "stack": 1,
                        }

                        chart["addSeries"](param);
                    }

                    var param = {
                        "name": "純資産",
                        "data": bsdata,
                        "stack": 2,
                        "index": 300,
                        "type": "line",
                        "color": "red",
                        "lineWidth": 4,
                        "shadow": true,
                        "marker": {
                            "symbol": "circle",
                        },
                    }

                    chart.addSeries(param);

                    var param_sers = {}

                    for (i = 0; i < index_ord.length; ++i) {
                        var name = index_ord[i];
                        sers = chart["get"]()["series"];
                        for (j = 0; j < index_ord.length; ++j) {
                            if (sers[j]["name"] == name) {
                                param_sers["series"] = [];
                                param_sers["series"][j] = {"index": index_ord.length};
                                chart.update(param_sers);
                                break;
                            }
                        }
                    }
                }
            }
        }

        function lia_fetch() {
            if (lia_ids.length == 0) {
                var xa = dbh.transaction(["lia_kv"], "readwrite");
                var cfm = xa.objectStore("lia_kv");
                cfm.put({key: "lastdate", date:lastdate});

                render_bals();
                return;
            }

            lia_id = lia_ids.shift();

            $.ajax({
                url:"/update_chart/"+lia_dur+"?account_id_hash="+lia_id+"&include_lia=true&type=account",
                dataType: "text",
                headers:{
                    Accept: "*/*;q=0.5, text/javascript, application/javascript, application/ecmascript, application/x-ecmascript",
                },
                success: function (data) {
                    eval(data);
                    lia_fetch();
                },
            });
        }

        function parse_acct(data) {
            var xa = dbh.transaction(["lia_accts"], "readwrite");
            var accts = xa.objectStore("lia_accts");

            $($.parseHTML(data)).find("#registration .row tr").each(function(){
                var id=$(this).attr("id");
                if (typeof(id) != "undefined") {
                    var row=$(this).find("td a").get();
                    if (row.length >= 1 && row[0].innerText in lia) {
                        var name = row[0].innerText;
                        accts.put({id:id, name:name, cat:lia[name]["cat"], bal:lia[name]["bal"]});
                        lia_ids.push(id);
                    }
                }
            });

            lia_fetch();
        }

        function parse_lia(data) {
            $($.parseHTML(data)).find("#liability_det table tr").each(function(){
                var row=$(this).find("td").get();
                if (row.length >= 4) {
                    var bal = 0 - row[2].innerText.replace(/[^0-9]/g, '');
                    lia[row[3].innerText] = {cat:row[0].innerText, bal:bal};
                }
            });

            chart = $("#container_time_series_trend").highcharts();

            var xa = dbh.transaction(["lia_kv"], "readonly");
            var kv = xa.objectStore("lia_kv");
            var getreq = kv.get("lastdate");
            getreq.onsuccess = function (evt) {
                if (typeof(evt.target.result) == "undefined" || evt.target.result["date"] == "") {
                    lia_dur = "all";
                } else {
                    var lastdate = evt.target.result["date"];
                    var cat = chart.get().categories;
                    var datediff = new Date(cat[cat.length - 2]) - new Date(lastdate);
                    if (datediff >= 25 * 86400000) {
                        lia_dur = "all";
                    } else if (datediff >= 86400000) {
                        lia_dur = "30";
                    } else {
                        lia_dur = "";
                    }
                }

                if (lia_dur != "") {
                    $.get("/accounts", parse_acct);
                } else {
                    var cat = chart.get().categories;
                    var d = cat[cat.length - 1];
                    var xa = dbh.transaction(["lia_accts"], "readonly");
                    var accts = xa.objectStore("lia_accts");
                    var getreq = accts.getAll();
                    getreq.onsuccess = function (evt) {
                        var result = evt.target.result;
                        if (typeof(result) == "undefined") {
                            $.get("/accounts", parse_acct);
                        } else {
                            var i;
                            var xa = dbh.transaction(["lia_bals"], "readwrite");
                            var bals = xa.objectStore("lia_bals");
                            for (i = 0; i < result.length; ++i) {
                                bals.put({date:d, id:result[i]["id"], bal:lia[result[i]["name"]]["bal"]});
                            }
                            render_bals();
                        }
                    }
                }
            }
        }

        function db_create(evt) {
            dbh = req.result;

            if (evt.oldVersion < 1) {
                var tbl;
                tbl = dbh.createObjectStore("lia_accts", {keyPath: "id"});
                tbl.createIndex("name", "name", {unique:true});

                tbl = dbh.createObjectStore("lia_bals", {keyPath: ["date", "id"]});

                tbl = dbh.createObjectStore("lia_kv", {keyPath: "key"});
            }
        }

        function db_opened() {
            dbh = req.result;

            $.get("/bs/liability", parse_lia);
        }

        req = indexedDB.open("tn_mf", 1);
        req.onupgradeneeded = db_create;
        req.onsuccess = db_opened;

        $("#container_time_series_trend").highcharts().setSize(null);
    }

    $("#copyright")["css"]({"padding":0});
    $(".container-large")["css"]({"width":"auto","padding":"1em"});
    $("#main-container")["css"]({"width":"auto"});

    $("#graph_contents .btn-group a.range-radio").click(function(){
        $.getScript($(this).attr("href"), update_chart);
        return false;
    });

    $("#graph_contents .btn-group a.active").click();
})();
