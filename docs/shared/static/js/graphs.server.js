/* Copyright 2012-2013 Ask Bjørn Hansen, Develooper LLC & NTP Pool Project */
/*jshint jquery:true browser:true */
/*globals d3:true */

function server_chart(div, data, options) {
    "use strict";

    if (!options) { options = {}; }
    var legend = options.legend;

    var history = data.history;

    $.each(history, function(i,d) {
        d.date = new Date(d.ts * 1000);
    });

    var y_offset_max = d3.max(history.map(function(e){ return e.offset * 1; })),
        y_offset_min = d3.min(history.map(function(e){ return e.offset * 1; }));

    // more than two seconds off and we'll stop showing just how bad
    if (y_offset_max >  2) { y_offset_max =  2; }
    if (y_offset_min < -2) { y_offset_min = -2; }

    $(".graph_desc").show();

    var w = ($(div).data("width")  || 480),
        h = ($(div).data("height") || 246),
        pad_w = 35,
        pad_h = 19,

        y_offset = d3.scale.pow().exponent(0.5).domain([y_offset_max, y_offset_min]).range([0, h]).clamp(true),

        y_score = d3.scale.sqrt().domain([25,-105]).range([0,h]),

        x = d3.time.scale.utc().domain([d3.min(history.map(function(e){ return e.date; })),
                                        d3.max(history.map(function(e){ return e.date; }))
            ])
            .range([0, w]);

    var svg = d3.select(div.get(0))
        .append("svg")
        .attr("width", w + pad_w * 2)
        .attr("height", h + pad_h * 2)
        .append("g")
        .attr("transform", "translate(" + pad_w + "," + pad_h + ")");

    var xticks = 6;

    var xrule = svg.selectAll("g.x")
        .data(x.ticks(xticks))
        .enter().append("g")
        .attr("class", "x");

    xrule.append("line")
        .attr("x1", x)
        .attr("x2", x)
        .attr("y1", 0)
        .attr("y2", h);

    xrule.append("text")
        .attr("x", x)
        .attr("y", h + 3)
        .attr("dy", ".71em")
        .attr("text-anchor", "middle")
        .text(x.tickFormat(xticks));

    /* offset y lines */
    var yrule = svg.selectAll("g.y")
        .data(y_offset.ticks(8))
        .enter().append("g")
        .attr("class", "y");

    yrule.append("line")
        .attr("x1", 0)
        .attr("x2", w)
        .attr("y1", y_offset)
        .attr("y2", y_offset);

    var yformat = d3.format((y_offset_max*1000 < 3 && y_offset_min*1000 > -3) ? "0.1f" : "0.0f");

    yrule.append("text")
        .attr("x", -3)
        .attr("y", y_offset)
        .attr("dy", ".35em")
        .attr("text-anchor", "end")
        .text(function(ms) {ms = ms * 1000;
                            return yformat(ms);
        });

    /* score y lines */
    var yrule_score = svg.selectAll("g.y_scores")
        .data([20,0,-20,-50,-100])
        .enter().append("g")
        .attr("class", "y_score");

    yrule_score.append("line")
        .attr("x1", 0)
        .attr("x2", w)
        .attr("y1", y_score)
        .attr("y2", y_score);

    yrule_score.append("text")
        .attr("x", w + 23)
        .attr("y", y_score)
        .attr("dy", ".35em")
        .attr("text-anchor", "end")
        .text(function(text) { return text; });


    var zero_offset = svg.selectAll("g.zero_offset")
        .data([0])
        .enter().append("g");

    zero_offset.append("line")
         .attr("x1", 0)
         .attr("x2", w)
         .attr("y1", y_offset(0))
         .attr("y2", y_offset(0))
         .attr("class", "x")
         .attr("stroke-width", 2)
         .attr("stroke", "black");

    svg.append("rect")
        .attr("width", w)
        .attr("height", h);

    svg.selectAll("g.scores")
        .data(data.history)
        .enter().append("circle")
        .filter(function(d) { return d.monitor_id ? true : false; })
        .attr("class", "scores monitor_data")
        .attr("r", 2)
        .attr("transform", function(d,i) {
            var tr = "translate(" + x(d.date) + "," + y_score(d.score) + ")";
            return tr;
        })
        .style("fill", function(d) {
            if (!d.monitor_id) {
                return "black";
            }
            if (d.step < -1) {
               return "red";
            }
            else if (d.step < 0) {
               return "orange";
            }
            else {
               return "steelblue";
            }
        })
        .on('mouseover',  fade(0.2))
        .on('mouseout',   fade(1));

    svg.selectAll("g.offsets")
        .data(data.history)
        .enter()
        .append("circle")
        .filter(function(d) { return d.monitor_id ? true : false; })
        .attr("class", "offsets monitor_data")
        .attr("r", 1.5) // todo: make this 2 if number of data points are < 250 or some such
        .attr("transform", function(d,i) { return "translate(" + x(d.date) + "," + y_offset(d.offset) + ")"; })
        .style("fill", function(d) {
            var offset = d.offset;

            if (offset < 0) { offset = offset * -1; }
            if ( offset < 0.050 ) {
                return "green";
            }
            else if ( offset < 0.100 ) {
                return "orange";
            }
            else {
                return "red";
           }
        })
        .on('mouseover',  fade(0.25))
        .on('mouseout',   fade(1));

    var dh = data.history.filter(function(d) { return d.monitor_id === null ? true : false; });
    //console.log("d.history", dh);

    svg.selectAll(".total_score")
        .data([dh])
        .enter().append("path")
        .attr("class", "line total_score")
        .style("fill", "none")
        .style("stoke", "red")
        .style("stroke-width", 2)
        .attr("d", d3.svg.line()
              .x(function(d) { return x(d.date); })
              .y(function(d) { return y_score(d.score); })
             );

   // Add Title then Legend
   svg.append("svg:text")
       .attr("x", 0)
       .attr("y", -5)
       .style("font-weight", "bold")
       .text("Offset monitoring and scores for " + data.server.ip);

    if (legend) {
        legend.css("margin-left", pad_w);
        legend.append('<span class="legend_header">Monitoring Station:</span>');
        for (var i = 0; i < data.monitors.length; i++) {
            var mon = data.monitors[i];
            var text = mon.name + " (" + mon.score + ")";
            legend.append($('<span>').text(text).addClass('legend').data('monitor_id', mon.id));
        }
        var fadeout = fade(0.25);
        var fadein  = fade(1);
        legend.find('span').mouseenter(function(e) {
                                        var mon = $(this).data('monitor_id');
                                        if (!mon) { return; }
                                        fadeout( { monitor_id: mon } );
                                    });
        legend.find('span').mouseleave(function(e) {
                                        var mon = $(this).data('monitor_id');
                                        if (!mon) { return; }
                                        fadein( { monitor_id: mon } );
                                    });
    }

    function fade (opacity) {
        return function(g, i) {
            svg.selectAll(".monitor_data")
               .filter(function(d) {
                   return d.monitor_id !== g.monitor_id;
               })
            .transition()
            .style("opacity", opacity);
        };
    };

}
