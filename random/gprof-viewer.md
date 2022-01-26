## Gprof Viewer

Simple call graph explorer for gprof output. All credit goes to 
1. José Fonseca - [gprof2dot](https://github.com/jrfonseca/gprof2dot) (got the regexes from his project)
2. Martin Spier - [d3-flame-graph](https://github.com/spiermar/d3-flame-graph).

<link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/d3-flame-graph@4.1.3/dist/d3-flamegraph.css">
<script src="https://d3js.org/d3.v7.min.js"></script>
<script type="text/javascript" src="https://cdn.jsdelivr.net/npm/d3-flame-graph@4.1.3/dist/d3-flamegraph.min.js"></script>
<script type="text/javascript" src="https://cdn.jsdelivr.net/npm/d3-flame-graph@4.1.3/dist/d3-flamegraph-tooltip.min.js"></script>
<script type="text/javascript" src="../assets/random/viewer.js" ></script>

<label for="gprofFile">Select a gprof file:</label>
<input type="file" id="gprofFile" name="myfile" onchange="onFileSelect(event)"> 
<div id="chart"></div>
