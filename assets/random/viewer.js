var primaryLineRegex = /^\[(\d+)\]?\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(?:(\d+)(?:\+(\d+))?)\s+(\S.*?)(?:\s+\s(\d+)>)?\s\[(\d+)\]$/
var headerLineRegex = /^\s+called\s+parents\s*$|^index\s+%time\s+self\s+descendents\s+called\+self\s+name\s+index\s*$|' +^\s+called\s+children\s*$|^index\s+%\s+time\s+self\s+children\s+called\s+name\s*$/
var ignoreLineRegex = /^\s+<spontaneous>\s*$|^.*\((\d+)\)$/
var parentLineRegex = /^\s+(\d+\.\d+)?\s+(\d+\.\d+)?\s+(\d+)(?:\/(\d+))?\s+(\S.*?)(?:\s+\s(\d+))?\s\[(\d+)\]$/
var childLineRegex = parentLineRegex
var separatorLineRegex = /^--+$/

var PRIMARY_INDEX = 1
var PRIMARY_TIME_PERCENTAGE = 2
var PRIMARY_TIME_IN_SELF = 3
var PRIMARY_TIME_IN_CHILDREN = 4
var PRIMARY_CALLED = 5
var PRIMARY_NAME = 7

var CHILD_INDEX = 7
var CHILD_NAME = 5
var CHILD_TIME_IN_SELF = 1
var CHILD_TIME_IN_CHILDREN = 2

var id2index = new Map();

var graph = flamegraph().transitionDuration(750)
                        .minFrameSize(5)
                        .transitionEase(d3.easeCubic)
                        .sort(true)
                        .title("Call Graph")
                        .minFrameSize(0)
                        .setColorHue("aqua")

function clearGraph()
{
    graph.destroy()
}

class ProfileLine
{
    constructor()
    {
        this.index = 0
        this.name = 'undefined'
        this.timeInSelf = 0.0
        this.timeInChildren = 0.0
        this.calls = 0
        this.totalCalls = 0
        this.value = 0
        this.children = []
    }
}


function onFileSelect(event) 
{
    // clean up previous run
    id2index = new Map();
    clearGraph()

	var selectedFile = event.target.files[0];
    var reader = new FileReader();
    reader.onload = function(event) 
    {
        var lines = event.target.result.split('\n');
        allProfileLines = parseLines(lines);
        updateGraph(allProfileLines)
    };
    reader.readAsText(selectedFile);
}

function parseLines(lines) 
{
    var allProfileLines = []
    var start = -1;
    for (let i = 0; i < lines.length; i++) 
    {
        if (headerLineRegex.test(lines[i]))
        {
            start = i;
            break;
        }
    }
    var cursor = start > -1 ? start + 1 : lines.length // skip if no header
    var stop = false;
    while (cursor < lines.length)
    {
        var section = new Array();
        while (true)
        {

            if (separatorLineRegex.test(lines[cursor]))
            {
                break;
            }
            if (lines[cursor].includes("This table describes the call tree of the program, and was sorted by")) // end of call graph section
            {
                stop = true;
                break;
            }
            section.push(lines[cursor])
            cursor++;
        }
        if (stop)
        {
            break;
        }
        allProfileLines.push(parseSection(section));
        id2index.set(allProfileLines[allProfileLines.length - 1].index, allProfileLines.length - 1);
        cursor++
    }
    return allProfileLines
}

function parseSection(lines)
{
    var children = new Array();
    var found = false;
    var profileLine = new ProfileLine();
    for (let i = 0; i < lines.length; i++)
    {
        var line = lines[i]
        if (!found && parentLineRegex.test(line))
        {
            continue
        }
        if (primaryLineRegex.test(line))
        {
            found = true;
            var match = primaryLineRegex.exec(line);
            profileLine.index = parseInt(match[PRIMARY_INDEX])
            profileLine.name = match[PRIMARY_NAME]
            profileLine.timeInSelf = parseFloat(match[PRIMARY_TIME_IN_SELF])
            profileLine.timeInChildren = parseFloat(match[PRIMARY_TIME_IN_CHILDREN])
            profileLine.value = profileLine.timeInSelf + profileLine.timeInChildren
        }
        if (found && childLineRegex.test(line))
        {
            var match = childLineRegex.exec(line);
            var childProfileLine = new ProfileLine();
            childProfileLine.index = parseInt(match[CHILD_INDEX])
            childProfileLine.name = match[CHILD_NAME]
            childProfileLine.timeInSelf = parseFloat(match[CHILD_TIME_IN_SELF])
            childProfileLine.timeInChildren = parseFloat(match[CHILD_TIME_IN_CHILDREN])
            childProfileLine.value = childProfileLine.timeInSelf + childProfileLine.timeInChildren
            profileLine.children.push(childProfileLine)
        }
    }
    return profileLine
}

function updateGraph(allProfileLines)
{
    // constructs the full tree
    var processedIndices = [];
    var cursor = 0;
    for (let i = allProfileLines.length - 1; i > 0; i--)
    {
        var line = allProfileLines[i]
        for (let j = 0; j < line.children.length; j++)
        {
            var childIndex = line.children[j].index
            line.children[j].children = allProfileLines[id2index.get(childIndex)].children
        }
    }

    // creates the flamegraph
    object = allProfileLines[1]

    // tooltip
    var tip = flamegraph.tooltip.defaultFlamegraphTooltip()
                                .text(d => d.data.name.split("(")[0] + ": " + d.data.value.toFixed(4));

    graph.tooltip(tip)

    d3.select("#chart").datum(object).call(graph);
}
