var dataPoints1 = [];
var serieNames = ["Mainmeter", "Average"];

var max = {
	val: Number.MIN_VALUE,
	arraypos: null
}
var min = {
	val: Number.MAX_VALUE,
	arraypos: null
}
var total = 0;
var averagePoints = [{
		x: null,
		y: null
	},
	{
		x: null,
		y: null
	}];
/*
  removeMarker (max/min) if new max/min has been detected
  IN: pos - position of old max/min point in graph 
*/
function removeMarker(pos)
{
	// First found min/max it tries removing markers on "prev" objects that do not exist. Lets not.
	if (pos == null)
	{
		/* As this only happens once (and at the beginning), we set this row here to
			skip doing another if (that runs everytime). What the row does is set the
			left datapoint for "average-line" to left (beginning) of the chart.
			There is data in dataPoints1 because we push before calling removeMarker.
		*/
		averagePoints[0].x = dataPoints1[0].x;

		return;
	}

	// object is set to itself but without the marker keys
	dataPoints1[pos] = {
		x: dataPoints1[pos].x,
		y: dataPoints1[pos].y
	}
}
/*
 pushData pushes new data to graph and update average calculation
 IN: timestamp - x value in graph
 IN: power - y value in graph
*/
function pushData(timestamp, power)
{
	dataPoints1.push({
		x: timestamp,
		y: power
	});

	updateAverage();
}
/*
 pushMarkerData pushes new data as max or min point
 IN: timestamp - x value in graph
 IN: power - y value in graph
 IN: type - type of marker (ex. triangle for max, square for min)
 IN: color - color of marker (ex. green for min, red for max)
*/
function pushMarkerData(timestamp, power, type, color)
{
	dataPoints1.push({
		x: timestamp,
		y: power,
		indexLabel: power+" W",
		markerType: type,
		markerColor: color,
		markerSize: 12
	});

	updateAverage();
}
/*
 updateMax updates new max marker 
 IN: timestamp - x value in graph
 IN: power - y value in graph
*/
function updateMax(timestamp, power)
{
	// Push the new data, with marker
	pushMarkerData(timestamp, power, "triangle", "red");

	// Remove marker on previous max
	removeMarker(max.arraypos);

	// Store new max
	max.val = power;
	max.arraypos = dataPoints1.length-1;	// point to (last) pushed element (0 indexed)
}
/*
 updateMin updates new min marker 
 IN: timestamp - x value in graph
 IN: power - y value in graph
*/
function updateMin(timestamp, power)
{
	// Push the new data, with marker
	pushMarkerData(timestamp, power, "circle", "green");

	// Remove marker on previous min
	removeMarker(min.arraypos);

	// Store new min
	min.val = power;
	min.arraypos = dataPoints1.length-1;	// point to (last) pushed element (0 indexed)
}
/*
 updateAverage calculates the average value in the graph and updates its marker
*/
function updateAverage()
{
	// Add the newly pushed value to total
	total += dataPoints1[dataPoints1.length-1].y;
	//console.log('Pre: ' + total)

	// Variables in JS are floats. They start loosing accuracy if they become too big.
	if (total > 999999999999999) console.log("Loosing accuracy for 'average'");

	var average = Math.round(total/dataPoints1.length);

	// set left and right datapoint to same "height"
	averagePoints[0].y = average;
	averagePoints[1].y = average;

	// set right datapoint to as far right as possible
	averagePoints[1].x = dataPoints1[dataPoints1.length-1].x;
}

/*
	Method for adjusting the average calculation
	1. calculate sum of y values for all points,
	2. reduce sum by y value of the point that will be removed
	3. calculate and set new average
*/
function adjustAverage(){
	var totalNew 	= averagePoints[0].y * dataPoints1.length;
	
	totalNew 	-= dataPoints1[0].y;
	total = totalNew;

	var average = Math.round(total / (dataPoints1.length - 1));
	averagePoints[0].y = average;
	averagePoints[1].y = average;
	averagePoints[0].x = dataPoints1[1].x;
}

window.onload = function() {
	/* CHART
		When the site is loaded it creates the chart object using CanvasJS.
	*/	
	var chart = new CanvasJS.Chart("chartContainer",{
		zoomEnabled: true,
		title: {
			text: "Munktell Science Park Power Consumption"		
		},
		legend: {
			verticalAlign: "top",
			horizontalAlign: "center",
			fontSize: 14,
			fontWeight: "bold",
			fontFamily: "calibri",
			fontColor: "dimGrey"
		},
		axisX: {
			title: "Power consumption",
			intervalType: "hour"
		},
		axisY: {
			includeZero: false
		}, 
		data: [{ 
			// dataSeries1
			type: "area",
			xValueType: "dateTime",
			showInLegend: true,
			name: serieNames[0],
			dataPoints: dataPoints1
		},
		{ 
			// Average
			type: "line",
			xValueType: "dateTime",
			showInLegend: true,
			name: serieNames[1],
			dataPoints: averagePoints
		}],
		legend: {
			cursor:"pointer",
			itemclick : function(e) {
				if (typeof(e.dataSeries.visible) === "undefined" || e.dataSeries.visible) {
					e.dataSeries.visible = false;
				}
				else {
					e.dataSeries.visible = true;
				}
				chart.render();
			}
		}
	});

	/* FILLING CHART
		Because the chart is empty after it is created, we fill it with data before start
		fetching the real-time data.
	*/
	for (var i = 0; i < historicalData.length; i++)
	{	
		var point = historicalData[historicalData.length - 1 - i];
		var time = new Date();
		time.setTime(point.time);
		var power = Math.round(point.power);

		if (power > max.val) 		updateMax(time, power);
		else if (power < min.val)	updateMin(time, power);
		else 						pushData(time, power);
	};

	// updating legend text with updated with y Value 
	chart.options.data[0].legendText = serieNames[0] + ": " + power + " W";
	chart.options.data[1].legendText = serieNames[1] + ": " + averagePoints[1].y + " W";

	//Change interval on x-axis (day/hour) depending on current showing view (realtime, day, week)
	if(view == "week"){
		chart.options.axisX.intervalType = "day";
	}
	else if(view == "day"){
		chart.options.axisX.intervalType = "hour";
	}
	else{
		chart.options.axisX.intervalType = "hour";
	}

	chart.render();


	/* SOCKET.IO METHODS
		The following code uses socket.io (websockets) to get data.
		It connects to port 8000 (where app.js is listening) and waits for messages
		labeled 'mqtt'. For each received message, it executes the given function.
	*/
	var socket = io.connect('http://localhost:8000');
	socket.on('mqtt', function (data) {
		if (data.topic == 'Testsites/MunktellSiencePark/mainmeter/meterevent' && view == "now")
		{
			console.log("Data via socket.io and mqtt");
			var parsedData = JSON.parse(data.payload);
			time = new Date();
			time.setTime(parsedData.time * 1000);
			var power =  Math.round(Number(parsedData.power));

			if (power > max.val) 		updateMax(time, power);
			else if (power < min.val)	updateMin(time, power);
			else 						pushData(time, power);

			//Adjust the average calculation after adding and remove oldest point via shifting
			adjustAverage();
			dataPoints1.shift();
			
			//Update legendtext
			chart.options.data[0].legendText = serieNames[0] + ": " + power + " W";
			chart.options.data[1].legendText = serieNames[1] + ": " + averagePoints[1].y + " W";

			// Sets the clock under the X-axis
			//chart.options.axisX.title = add0(time.getHours()) + ':' + add0(time.getMinutes()) + ':' + add0(time.getSeconds());
			chart.options.axisX.title = moment(time).format("HH:mm:ss");
			chart.render();
		}
		else if(view != "now"){
			console.log("disconnect");
			socket.disconnect();
		}
	});
	socket.on('event', function(data){
		//On new priorityCard-event, update information in the prioritycards
		for(var i = 0; i < 4; i++){
			if(!(parseInt($(".priorityCard")[i].id) === data.payload[i].sequenceNo)){
				document.getElementById("type" + i).innerHTML = data.payload[i].type;
				document.getElementById("date" + i).innerHTML = data.payload[i].date;
				document.getElementById("time" + i).innerHTML = data.payload[i].time;
				document.getElementById("value" + i).innerHTML = 'Value: ' + data.payload[i].value + ' W';
			}
		}
	})

}