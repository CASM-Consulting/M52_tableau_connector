(function (){
    var myConnector = tableau.makeConnector();

    setupConnector = function (){
        var server = $('#serverInput').val().trim();
        var token = $('#tokenInput').val().trim();
        if (server && token){
            tableau.connectionData = JSON.stringify({server: server, token: token});
            tableau.connectionName = "Method52";
        }
    };

    myConnector.getSchema = function (schemaCallback){
        var params = JSON.parse(tableau.connectionData);
        var cols = [];
        // http://stackoverflow.com/questions/3595515/xmlhttprequest-error-origin-null-is-not-allowed-by-access-control-allow-origin
        var apiURL = params.server + "/api/component?target=schema&access_token=" + params.token;

        var types = {
            "java.lang.Long": tableau.dataTypeEnum.int,
            "java.lang.Integer": tableau.dataTypeEnum.int,
            "java.lang.Float": tableau.dataTypeEnum.float,
            "java.lang.Double": tableau.dataTypeEnum.float,
            "java.lang.String": tableau.dataTypeEnum.string,
            "java.lang.Boolean": tableau.dataTypeEnum.bool,
            "org.joda.time.Instant": tableau.dataTypeEnum.date,
        }
        // todo how do we handle "java.util.List"?

        $.getJSON(apiURL, function (resp){
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
            for (var keyName in resp){
                if (resp.hasOwnProperty(keyName)){

                }
            }
        }).success(function (){
            var tableInfo = {
                id: "M52Feed",
		        alias: "table",
                description: "Data from the M52 API",
                columns: cols
            };

            schemaCallback([tableInfo]);
        });
    };

    myConnector.getData = function (table, doneCallback){
        var params = JSON.parse(tableau.connectionData);
        var apiURL = params.server + "/api/component?access_token=" + params.token;
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
                            if (value.iMillis !== undefined){
                                // this is a serialised jodatime Instant
                                value = value.iMillis;
                            }
                            cleanedObj[keyName.replace(/\W+/g, "_")] = value;
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
        $("#submitButton").click(function (){
            console.log("clicked");
            setupConnector();
            tableau.submit();
        });
    });
})();
