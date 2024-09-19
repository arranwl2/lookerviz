// Include the Looker visualization API
looker.plugins.visualizations.add({
  id: "pivoted_line_chart",
  label: "Pivoted Line Chart",
  options: {
    lineColors: {
      type: "array",
      label: "Line Colors",
      display: "color",
      default: ["#FF5733", "#33C1FF", "#9D33FF", "#33FF57"]
    },
    pointSize: {
      type: "number",
      label: "Point Size",
      default: 5
    }
  },

  create: function (element, config) {
    this.container = element.appendChild(document.createElement("div"));
    this.container.style.width = "100%";
    this.container.style.height = "100%";

    this.svg = d3
      .select(this.container)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%");
  },

  update: function (data, element, config, queryResponse) {
    // Clear previous content
    this.svg.selectAll("*").remove();

    // Ensure there's at least one dimension and one measure, with pivoted data
    if (
      queryResponse.fields.dimensions.length === 0 ||
      queryResponse.fields.pivots.length === 0 ||
      queryResponse.fields.measure_like.length === 0
    ) {
      this.addError({
        title: "No Dimensions, Measures, or Pivots",
        message: "This visualization requires a dimension, a measure, and a pivot."
      });
      return;
    }

    // Extract the dimension, measure, and pivots from the queryResponse
    const dimension = queryResponse.fields.dimensions[0];
    const measure = queryResponse.fields.measure_like[0];
    const pivots = queryResponse.fields.pivots;

    // Prepare the dataset from Looker data
    let dataset = data.map(row => {
      let obj = { x: row[dimension.name].value };
      pivots.forEach(pivot => {
        obj[pivot.key] = row[measure.name][pivot.key].value;
      });
      return obj;
    });

    // Define SVG canvas dimensions
    let width = element.clientWidth;
    let height = element.clientHeight;
    let margin = { top: 20, right: 20, bottom: 30, left: 40 };
    let innerWidth = width - margin.left - margin.right;
    let innerHeight = height - margin.top - margin.bottom;

    // Create the scales
    let xScale = d3.scaleTime().range([0, innerWidth]);
    let yScale = d3.scaleLinear().range([innerHeight, 0]);

    // Define the line generator
    let lineGenerator = d3
      .line()
      .x(function (d) { return xScale(new Date(d.x)); })
      .y(function (d) { return yScale(d.y); });

    // Set the domains for the scales based on the data
    xScale.domain(d3.extent(dataset, function (d) { return new Date(d.x); }));

    // Flatten all the pivoted values to get a full range for the y-axis
    let allYValues = [];
    dataset.forEach(row => {
      pivots.forEach(pivot => {
        allYValues.push(row[pivot.key]);
      });
    });
    yScale.domain([0, d3.max(allYValues)]);

    // Create a group for the chart
    let g = this.svg
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Add X axis
    g.append("g")
      .attr("transform", "translate(0," + innerHeight + ")")
      .call(d3.axisBottom(xScale));

    // Add Y axis
    g.append("g").call(d3.axisLeft(yScale));

    // Define a color scale if there are more pivot values than predefined colors
    let colorScale = d3.scaleOrdinal()
      .domain(pivots.map(p => p.key))
      .range(config.lineColors || d3.schemeCategory10);

    // Create a line for each pivoted series
    pivots.forEach((pivot, index) => {
      let lineData = dataset.map(row => ({ x: row.x, y: row[pivot.key] }));

      // Draw the line for the pivot
      g.append("path")
        .datum(lineData)
        .attr("fill", "none")
        .attr("stroke", colorScale(pivot.key))
        .attr("stroke-width", 1.5)
        .attr("d", lineGenerator);

      // Draw points for each data point in the series
      g.selectAll(".dot-" + pivot.key)
        .data(lineData)
        .enter()
        .append("circle")
        .attr("class", "dot-" + pivot.key)
        .attr("cx", function (d) { return xScale(new Date(d.x)); })
        .attr("cy", function (d) { return yScale(d.y); })
        .attr("r", config.pointSize || 5)
        .attr("fill", colorScale(pivot.key));
    });
  }
});
