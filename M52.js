(function (){
    var myConnector = tableau.makeConnector();
    var cols;

    setupConnector = function (){
        var server = $('#serverInput').val().trim();
        var token = $('#tokenInput').val().trim();
        var selectedCols = [];
        // http://stackoverflow.com/questions/3595515/xmlhttprequest-error-origin-null-is-not-allowed-by-access-control-allow-origin
        // todo how do we handle "java.util.List"?
        
        $("#keySelection input[type=checkbox]:checked").each(function(idx, el) {
            var index = $(el).closest("tr").data("index");
            selectedCols.push(cols[index]);
        });
        var tableInfo = {
            id: "M52Feed",
            alias: "table",
            description: "Data from the M52 API",
            columns: selectedCols
        };
        if (server && token){
            tableau.connectionData = JSON.stringify({
                server: server, 
                token: token,
                tableInfo : tableInfo
            });
            tableau.connectionName = "Method52";
        }
    };

    var attachMouseDrag = function() {

        var down = false;
        var current = [false];
        var firstDrag = false;
        $("#keySelection tr")
        .mousedown(function(ev) {
           down = true;
           firstDrag = true;
           current = $(ev.target).closest("tr");
           // console.log("down");
        })
        .mousemove(function(ev) {
            var el = $(ev.target).closest("tr");
            if(down && el[0] != current[0]) {
                current = el;
                var cb = current.find("input");
                cb.prop("checked", !cb.prop("checked"));
                // console.log(ev);
            }
            if(firstDrag) {
                var cb = el.find("input");
                cb.prop("checked", !cb.prop("checked"));
                firstDrag = false;
            }
         })
        .mouseup(function(ev) {
            down = false;
            var el = $(ev.target).closest("tr");
            if(el[0] = current[0] && ev.target.type != "checkbox" && firstDrag) {
                var cb = current.find("input");
                cb.prop("checked", !cb.prop("checked"));
            }
            firstDrag = false;
           // console.log("up");
        });
    };

    var getSchema = function (){
        var token = $("#tokenInput").val().trim();
        var server = $('#serverInput').val().trim();

        // http://stackoverflow.com/questions/3595515/xmlhttprequest-error-origin-null-is-not-allowed-by-access-control-allow-origin
        var apiURL = server + "/supergui/access-tokens/handle?target=schema&token=" + token;

        var types = {
            "java.lang.Long": tableau.dataTypeEnum.int,
            "java.lang.Integer": tableau.dataTypeEnum.int,
            "java.lang.Float": tableau.dataTypeEnum.float,
            "java.lang.Double": tableau.dataTypeEnum.float,
            "java.lang.String": tableau.dataTypeEnum.string,
            "java.lang.Boolean": tableau.dataTypeEnum.bool,
            "org.joda.time.Instant": tableau.dataTypeEnum.date,
        }

        $.getJSON(apiURL, function (resp){
            cols = [];

            $.each(resp.schema, function (keyName, value){
                //http://tableau.github.io/webdataconnector/ref/api_ref.html#webdataconnectorapi.columninfo
                const type = types[value.type.class];
                if (type == 'java.util.List' || type === undefined){
                    return true; // continue
                }

                cols.push({
                    id: keyName.replace(/\W+/g, "_"),
                    alias: keyName,
                    description: 'Original name is "' + keyName + '"in',
                    dataType: type
                });
                
            });

            cols.sort(function(a,b){
                var textA = a.alias.toUpperCase();
                var textB = b.alias.toUpperCase();
                return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
            });

            $.each(cols, function(index, value){
                $('#keySelection > tbody:last-child').append('<tr data-index="'+index+'"><td>'+value.alias+'</td><td><input type="checkbox"></td></tr>');
            });

            attachMouseDrag();
            $("#submitButton").prop('disabled', false);
        });
    };

    myConnector.getSchema = function (schemaCallback){
        var params = JSON.parse(tableau.connectionData);
        schemaCallback([params.tableInfo]);
    };

    myConnector.getData = function (table, doneCallback){
        var params = JSON.parse(tableau.connectionData);
        var apiURL = params.server + "/supergui/access-tokens/handle?token=" + params.token;
        var originalURL = apiURL;
        var getMoreData = function (){
            $.getJSON(apiURL, function (resp){
                if (resp.data == "EOF"){
                    console.info("End of data stream");
                    doneCallback();
                } else {
                    if (resp.data.length==0){
                        console.info("No new data has been fetched.");
                    } else {
                        console.info("Got more data: " + resp.data.length);
                    }

                    var parsedResponse = [];
                    $.each(resp.data, function (index, rawObj){
                        var cleanedObj = new Object();

                        $.each(rawObj, function (keyName, value){
                            if (value != null && value.iMillis !== undefined){
                                // this is a serialised jodatime Instant
                                value = value.iMillis;
                            }
                            var cleanKey = keyName.replace(/\W+/g, "_");
                            cleanedObj[cleanKey] = value;
                        })

                        parsedResponse.push(cleanedObj);
                    });

                    table.appendRows(parsedResponse);

                    if (resp.next) {
                        apiURL = originalURL + "&next=" + resp.next;
                    }

                    getMoreData();
                }
            }).error(function (jqXHR, textStatus, errorThrown){
                tableau.abortWithError(errorThrown + "; " + textStatus);
            })
            ;
        }

        getMoreData();

    };

    tableau.registerConnector(myConnector);

    $(document).ready(function (){

        $("#toggleSelected").click(function (){
            $("#keySelection input[type=checkbox]").each(function(i, cb){
                $(cb).prop("checked", !$(cb).prop("checked"));
            });
        });
        $("#allSelected").click(function (){
            $("#keySelection input[type=checkbox]").each(function(i, cb){
                $(cb).prop("checked", true);
            });
        });

        $("#checkToken").click(function (){

            getSchema();

        });
        $("#submitButton").click(function (){
            console.log("clicked");
            setupConnector();
            tableau.submit();
        });
    });
})();
