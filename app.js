/* ========================================
   Map
======================================== */

const map =
  L.map("map", {
    zoomControl: false
  }).setView(

    [
      47.9187,
      106.9075
    ],

    14

  );


L.tileLayer(

  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

  {

    maxZoom: 19,

    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'

  }

).addTo(map);



/* ========================================
   Route Geometry
======================================== */

const routeBasePane =
  map.createPane(
    "route-base"
  );


routeBasePane.style.zIndex =
  410;


routeBasePane.style.pointerEvents =
  "none";


const routeOutlinePane =
  map.createPane(
    "route-outline"
  );


routeOutlinePane.style.zIndex =
  420;


routeOutlinePane.style.pointerEvents =
  "none";


const routeActivePane =
  map.createPane(
    "route-active"
  );


routeActivePane.style.zIndex =
  430;


routeActivePane.style.pointerEvents =
  "none";


let routePolyline =
  null;


let ch52GeometryByRelationId =
  null;


let ch52GeometryPromise =
  null;


let routeSearchRequestId =
  0;



function clearRoutePolyline() {


  if (
    routePolyline
  ) {


    map.removeLayer(
      routePolyline
    );


    routePolyline =
      null;

  }

}



async function loadCh52Geometry() {


  if (
    ch52GeometryByRelationId
  ) {


    return ch52GeometryByRelationId;

  }


  if (
    !ch52GeometryPromise
  ) {


    ch52GeometryPromise =
      fetch(
        "./data/routes/ch52-geometry.json"
      )
        .then(

          (response) => {


            if (
              !response.ok
            ) {


              throw new Error(
                `Failed to load route geometry: ${response.status}`
              );

            }


            return response.json();

          }

        )
        .then(

          (data) => {


            if (
              !Array.isArray(
                data.routes
              )
            ) {


              throw new Error(
                "Invalid route geometry data."
              );

            }


            return new Map(

              data.routes.map(

                (route) => [
                  route.relationId,
                  route
                ]

              )

            );

          }

        );

  }


  try {


    ch52GeometryByRelationId =
      await ch52GeometryPromise;


    return ch52GeometryByRelationId;

  }


  catch (error) {


    ch52GeometryPromise =
      null;


    throw error;

  }

}



function getRouteFitBoundsOptions() {


  const mapRect =
    map.getContainer()
      .getBoundingClientRect();


  const panelRect =
    routePanel.getBoundingClientRect();


  const panelOverlap =
    routePanelOpen

      ? Math.max(
          0,
          mapRect.bottom - panelRect.top
        )

      : 0;


  const bottomPadding =
    Math.min(
      panelOverlap + 24,
      Math.floor(
        mapRect.height * 0.55
      )
    );


  return {

    paddingTopLeft:
      [24, 24],

    paddingBottomRight:
      [24, bottomPadding]

  };

}



function getClosestRoutePoint(
  coordinates,
  projectedCoordinates,
  stop
) {


  const stopPoint =
    L.CRS.EPSG3857.project(
      L.latLng(
        stop.lat,
        stop.lng
      )
    );


  let closestPoint =
    null;


  for (
    let index = 0;
    index < projectedCoordinates.length - 1;
    index++
  ) {


    const segmentStart =
      projectedCoordinates[index];


    const segmentEnd =
      projectedCoordinates[index + 1];


    const deltaX =
      segmentEnd.x - segmentStart.x;


    const deltaY =
      segmentEnd.y - segmentStart.y;


    const segmentLengthSquared =
      deltaX * deltaX +
      deltaY * deltaY;


    const position =
      segmentLengthSquared === 0

        ? 0

        : Math.max(
            0,
            Math.min(
              1,
              (
                (stopPoint.x - segmentStart.x) * deltaX +
                (stopPoint.y - segmentStart.y) * deltaY
              ) /
              segmentLengthSquared
            )
          );


    const projectedPoint =
      L.point(
        segmentStart.x + deltaX * position,
        segmentStart.y + deltaY * position
      );


    const distanceSquared =
      Math.pow(
        stopPoint.x - projectedPoint.x,
        2
      ) +
      Math.pow(
        stopPoint.y - projectedPoint.y,
        2
      );


    if (
      !closestPoint ||

      distanceSquared <
        closestPoint.distanceSquared
    ) {


      const latLng =
        L.CRS.EPSG3857.unproject(
          projectedPoint
        );


      closestPoint = {

        segmentIndex:
          index,

        position:
          position,

        distanceSquared:
          distanceSquared,

        coordinate: [
          latLng.lat,
          latLng.lng
        ]

      };

    }

  }


  return closestPoint;

}



function getRouteSegmentCoordinates(
  coordinates,
  startStop,
  destinationStop
) {


  const projectedCoordinates =
    coordinates.map(

      (coordinate) =>
        L.CRS.EPSG3857.project(
          L.latLng(
            coordinate[0],
            coordinate[1]
          )
        )

    );


  const startPoint =
    getClosestRoutePoint(
      coordinates,
      projectedCoordinates,
      startStop
    );


  const destinationPoint =
    getClosestRoutePoint(
      coordinates,
      projectedCoordinates,
      destinationStop
    );


  if (
    !startPoint ||

    !destinationPoint ||

    startPoint.segmentIndex + startPoint.position >
      destinationPoint.segmentIndex + destinationPoint.position
  ) {


    throw new Error(
      "Could not extract the selected route segment."
    );

  }


  const segmentCoordinates = [
    startPoint.coordinate
  ];


  for (
    let index = startPoint.segmentIndex + 1;
    index <= destinationPoint.segmentIndex;
    index++
  ) {


    segmentCoordinates.push(
      coordinates[index]
    );

  }


  segmentCoordinates.push(
    destinationPoint.coordinate
  );


  return segmentCoordinates.filter(

    (coordinate, index) => {


      if (
        index === 0
      ) {


        return true;

      }


      const previousCoordinate =
        segmentCoordinates[index - 1];


      return (

        coordinate[0] !==
          previousCoordinate[0] ||

        coordinate[1] !==
          previousCoordinate[1]

      );

    }

  );

}



async function showRouteGeometry(
  routeMatch,
  startStop,
  destinationStop,
  requestId
) {


  const geometryByRelationId =
    await loadCh52Geometry();


  if (
    requestId !== routeSearchRequestId
  ) {


    return;

  }


  const routeGeometry =
    geometryByRelationId.get(
      routeMatch.route.relationId
    );


  if (
    !routeGeometry ||

    !Array.isArray(
      routeGeometry.coordinates
    ) ||

    routeGeometry.coordinates.length < 2
  ) {


    throw new Error(
      `Route geometry not found: ${routeMatch.route.relationId}`
    );

  }


  const segmentCoordinates =
    getRouteSegmentCoordinates(
      routeGeometry.coordinates,
      startStop,
      destinationStop
    );


  clearRoutePolyline();


  routePolyline =
    L.featureGroup([

      L.polyline(

        routeGeometry.coordinates,

        {

          pane:
            "route-base",

          color:
            "#1D4ED8",

          weight:
            4,

          opacity:
            0.6,

          lineCap:
            "round",

          lineJoin:
            "round",

          interactive:
            false

        }

      ),


      L.polyline(

        segmentCoordinates,

        {

          pane:
            "route-outline",

          color:
            "#ffffff",

          weight:
            9,

          opacity:
            1,

          lineCap:
            "round",

          lineJoin:
            "round",

          interactive:
            false

        }

      ),


      L.polyline(

        segmentCoordinates,

        {

          pane:
            "route-active",

          color:
            "#D81B60",

          weight:
            5,

          opacity:
            1,

          lineCap:
            "round",

          lineJoin:
            "round",

          interactive:
            false

        }

      )

    ]).addTo(map);


  map.fitBounds(

    L.latLngBounds(
      segmentCoordinates
    ),

    getRouteFitBoundsOptions()

  );

}



/* ========================================
   Current Location
======================================== */

const currentLocationIcon =
L.icon({

    iconUrl:
    "./assets/images/marker-icon-2x-green.png",

    shadowUrl:
    "./assets/images/marker-shadow.png",

    iconSize:
    [25, 41],

    iconAnchor:
    [12, 41],

    popupAnchor:
    [1, -34],

    shadowSize:
    [41, 41]

  });



navigator.geolocation.getCurrentPosition(

  (position) => {


    const lat =
      position.coords.latitude;


    const lng =
      position.coords.longitude;


    L.marker(
      [lat, lng],
      {
        icon:
          currentLocationIcon
      }
    )

      .addTo(map)

      .bindPopup(
        "Current Location"
      );


    map.setView(
      [lat, lng],
      16
    );

  },


  (error) => {

    console.error(

      "Could not get current location.",

      error

    );

  },


  {

    enableHighAccuracy: true,

    timeout: 10000,

    maximumAge: 0

  }

);



/* ========================================
   Bus Stop Icon
======================================== */

const busStopIcon =
  L.divIcon({

    className: "",

    html:
      '<div class="bus-stop-marker">B</div>',

    iconSize:
      [22, 22],

    iconAnchor:
      [11, 11],

    popupAnchor:
      [0, -11]

  });


const routeEndpointBusStopIcon =
  L.divIcon({

    className: "",

    html:
      '<div class="bus-stop-marker route-endpoint">B</div>',

    iconSize:
      [22, 22],

    iconAnchor:
      [11, 11],

    popupAnchor:
      [0, -11]

  });



/* ========================================
   Bus Stop Layer
======================================== */

const busStopLayer =
  L.layerGroup()
    .addTo(map);


function showAllBusStops() {


  busStopLayer.clearLayers();


  busStops.forEach(

    (stop) => {


      if (
        stop.marker
      ) {


        stop.marker.setIcon(
          busStopIcon
        );


        busStopLayer.addLayer(
          stop.marker
        );

      }

    }

  );

}



function showBusStopsForRoute(
  route,
  startStop,
  destinationStop
) {


  const platformIds =
    new Set(
      route.platformIds
    );


  busStopLayer.clearLayers();


  busStops.forEach(

    (stop) => {


      const isRouteStop =
        stop.nodeIds.some(

          (nodeId) =>
            platformIds.has(
              nodeId
            )

        );


      if (
        stop.marker
      ) {


        stop.marker.setIcon(
          busStopIcon
        );

      }


      if (
        isRouteStop &&

        stop.marker
      ) {


        busStopLayer.addLayer(
          stop.marker
        );

      }

    }

  );


  [
    startStop,
    destinationStop
  ].forEach(

    (stop) => {


      if (
        stop.marker
      ) {


        stop.marker.setIcon(
          routeEndpointBusStopIcon
        );

      }

    }

  );

}


let busStopsVisible =
  true;


const busStopToggle =
  document.getElementById(
    "bus-stop-toggle"
  );



busStopToggle.addEventListener(

  "click",

  () => {


    if (
      busStopsVisible
    ) {


      map.removeLayer(
        busStopLayer
      );


      busStopsVisible =
        false;


      busStopToggle
        .classList
        .remove(
          "hide-action"
        );


      busStopToggle.setAttribute(

        "aria-label",

        "Show bus stops"

      );

    }


    else {


      busStopLayer
        .addTo(map);


      busStopsVisible =
        true;


      busStopToggle
        .classList
        .add(
          "hide-action"
        );


      busStopToggle.setAttribute(

        "aria-label",

        "Hide bus stops"

      );

    }

  }

);



/* ========================================
   Route Panel Open / Close
======================================== */

const routePanel =
  document.getElementById(
    "route-panel"
  );


const panelToggle =
  document.getElementById(
    "panel-toggle"
  );


let routePanelOpen =
  true;



panelToggle.addEventListener(

  "click",

  () => {


    if (
      routePanelOpen
    ) {


      routePanel.classList.add(
        "closed"
      );


      panelToggle.textContent =
        "▲";


      panelToggle.setAttribute(

        "aria-label",

        "Open route search"

      );


      routePanelOpen =
        false;

    }


    else {


      routePanel.classList.remove(
        "closed"
      );


      panelToggle.textContent =
        "▼";


      panelToggle.setAttribute(

        "aria-label",

        "Close route search"

      );


      routePanelOpen =
        true;

    }

  }

);



/* ========================================
   Bus Stop Data
======================================== */

const busStops =
  [];


const zaisanNodeIds = [
  1400358994,
  13915478001
];


let zaisanStopLoaded =
  false;


const ch52Routes = [

  {

    relationId:
      20961296,

    routeNumber:
      "Ч:52",

    from:
      "Зайсан",

    to:
      "Дүүхээ дэлгүүр",

    platformIds: [
      1400358994,
      13915131455,
      13915417487,
      13915417488,
      13926195612,
      1255473522,
      1193607633,
      1241686912,
      13926195613,
      1707027495,
      2531768741,
      1601426940,
      3912937179,
      5931237085,
      2531768745,
      11063192121,
      11063192120
    ]

  },

  {

    relationId:
      20961297,

    routeNumber:
      "Ч:52",

    from:
      "Дүүхээ дэлгүүр",

    to:
      "Зайсан",

    platformIds: [
      11063192123,
      2321375414,
      2531768538,
      2321375421,
      2531768740,
      1707027426,
      750022312,
      3023597332,
      1193607646,
      1255473563,
      1601411404,
      9157069767,
      13915131456,
      1400358994
    ]

  }

];


let startBusStop =
  null;


let destinationBusStop =
  null;



const startInput =
  document.getElementById(
    "start-stop-input"
  );


const destinationInput =
  document.getElementById(
    "destination-stop-input"
  );


const startSuggestions =
  document.getElementById(
    "start-stop-suggestions"
  );


const destinationSuggestions =
  document.getElementById(
    "destination-stop-suggestions"
  );


const routeSearchButton =
  document.getElementById(
    "route-search-button"
  );


const routeResults =
  document.getElementById(
    "route-results"
  );



function clearRouteResults() {


  routeResults.innerHTML =
    "";

}



/* ========================================
   Route Search Button State
======================================== */

function updateRouteSearchButton() {


  routeSearchButton.disabled =

    !startBusStop ||

    !destinationBusStop;

}



/* ========================================
   Set Start / Destination
======================================== */

function setBusStop(
  type,
  stop
) {


  clearRouteResults();


  if (
    type === "start"
  ) {


    startBusStop =
      stop;


    startInput.value =
      stop.displayName;


    startSuggestions.innerHTML =
      "";

  }



  if (
    type === "destination"
  ) {


    destinationBusStop =
      stop;


    destinationInput.value =
      stop.displayName;


    destinationSuggestions.innerHTML =
      "";

  }


  updateRouteSearchButton();

}



/* ========================================
   Load Bus Stops
======================================== */

async function loadBusStops() {


  try {


    const response =
      await fetch(
        "./busstops-osm.json"
      );


    if (
      !response.ok
    ) {


      throw new Error(

        `Failed to load file: ${response.status}`

      );

    }


    const data =
      await response.json();


    if (

      !Array.isArray(
        data.elements
      )

    ) {


      throw new Error(
        "Invalid OSM data."
      );

    }



    let count =
      0;



    data.elements.forEach(

      (element) => {


        const lat =

          element.lat ??

          element.center?.lat;


        const lng =

          element.lon ??

          element.center?.lon;



        if (

          !Number.isFinite(lat) ||

          !Number.isFinite(lng) ||

          Math.abs(lat) > 90 ||

          Math.abs(lng) > 180

        ) {


          return;

        }


        const isZaisan =
          zaisanNodeIds.includes(
            element.id
          );


        if (

          isZaisan &&

          zaisanStopLoaded

        ) {


          return;

        }


        if (
          isZaisan
        ) {


          zaisanStopLoaded =
            true;

        }



        const tags =
          element.tags ?? {};


        const names = [

          tags["name:mn"] ||
          tags.name,

          tags["name:en"]

        ].filter(Boolean);


        const displayName =

          [...new Set(names)]
            .join(" / ")

          ||

          "Unnamed Bus Stop";



        const stop = {


          id:
            isZaisan

              ? zaisanNodeIds[0]

              : element.id,


          nodeIds:

            isZaisan

              ? [...zaisanNodeIds]

              : [element.id],


          lat:
            lat,


          lng:
            lng,


          displayName:
            displayName,


          nameMn:

            tags["name:mn"] ||

            tags.name ||

            "",


          nameEn:

            tags["name:en"] ||

            ""

        };


        busStops.push(
          stop
        );



        const marker =
          L.marker(

            [
              lat,
              lng
            ],

            {

              icon:
                busStopIcon

            }

          );



        const popup =
          document.createElement(
            "div"
          );


        const title =
          document.createElement(
            "div"
          );


        title.textContent =
          displayName;


        title.style.fontWeight =
          "bold";


        popup.appendChild(
          title
        );



        const startButton =
          document.createElement(
            "button"
          );


        startButton.textContent =
          "Set as Start";


        startButton.className =
          "popup-button";


        startButton.addEventListener(

          "click",

          () => {


            setBusStop(
              "start",
              stop
            );


            map.closePopup();

          }

        );



        const destinationButton =
          document.createElement(
            "button"
          );


        destinationButton.textContent =
          "Set as Destination";


        destinationButton.className =
          "popup-button";


        destinationButton.addEventListener(

          "click",

          () => {


            setBusStop(
              "destination",
              stop
            );


            map.closePopup();

          }

        );



        popup.appendChild(
          startButton
        );


        popup.appendChild(
          destinationButton
        );


        marker

          .addTo(
            busStopLayer
          )

          .bindPopup(
            popup
          );


        stop.marker =
          marker;


        count++;

      }

    );


    console.log(

      `${count} bus stops loaded.`

    );

  }


  catch (error) {


    console.error(
      error
    );


    alert(

      "Could not load bus stop data.\n"

      +

      error.message

    );

  }

}



loadBusStops();



/* ========================================
   Bus Stop Search
======================================== */

function searchBusStops(

  query,

  resultElement,

  type

) {


  resultElement.innerHTML =
    "";


  const text =

    query

      .trim()

      .toLowerCase();


  if (
    !text
  ) {

    return;

  }



  const results =

    busStops

      .filter(

        (stop) => {


          return (

            stop.displayName
              .toLowerCase()
              .includes(text)

            ||

            stop.nameMn
              .toLowerCase()
              .includes(text)

            ||

            stop.nameEn
              .toLowerCase()
              .includes(text)

          );

        }

      )

      .slice(
        0,
        8
      );



  if (
    results.length === 0
  ) {


    const noResult =
      document.createElement(
        "div"
      );


    noResult.className =
      "bus-suggestion";


    noResult.textContent =
      "No bus stops found";


    resultElement.appendChild(
      noResult
    );


    return;

  }



  results.forEach(

    (stop) => {


      const item =
        document.createElement(
          "div"
        );


      item.className =
        "bus-suggestion";


      item.textContent =
        stop.displayName;


      item.addEventListener(

        "click",

        () => {


          setBusStop(
            type,
            stop
          );


          map.setView(

            [
              stop.lat,
              stop.lng
            ],

            16

          );


          if (
            busStopsVisible
          ) {


            stop.marker
              .openPopup();

          }

        }

      );


      resultElement.appendChild(
        item
      );

    }

  );

}



/* ========================================
   Start Input
======================================== */

startInput.addEventListener(

  "input",

  () => {


    if (

      startBusStop &&

      startInput.value !==
        startBusStop.displayName

    ) {


      startBusStop =
        null;


      clearRouteResults();


      updateRouteSearchButton();

    }


    searchBusStops(

      startInput.value,

      startSuggestions,

      "start"

    );

  }

);



/* ========================================
   Destination Input
======================================== */

destinationInput.addEventListener(

  "input",

  () => {


    if (

      destinationBusStop &&

      destinationInput.value !==
        destinationBusStop.displayName

    ) {


      destinationBusStop =
        null;


      clearRouteResults();


      updateRouteSearchButton();

    }


    searchBusStops(

      destinationInput.value,

      destinationSuggestions,

      "destination"

    );

  }

);



/* ========================================
   Search Routes
======================================== */

function findDirectRouteMatch(
  route,
  startStop,
  destinationStop
) {


  for (
    const startNodeId of startStop.nodeIds
  ) {


    for (
      const destinationNodeId of destinationStop.nodeIds
    ) {


      const startIndex =
        route.platformIds.indexOf(
          startNodeId
        );


      const destinationIndex =
        route.platformIds.indexOf(
          destinationNodeId
        );


      if (

        startIndex !== -1 &&

        destinationIndex !== -1 &&

        startIndex < destinationIndex

      ) {


        return {

          route:
            route,

          startNodeId:
            startNodeId,

          destinationNodeId:
            destinationNodeId,

          startIndex:
            startIndex,

          destinationIndex:
            destinationIndex

        };

      }

    }

  }


  return null;

}

routeSearchButton.addEventListener(

  "click",

  async () => {


    if (

      !startBusStop ||

      !destinationBusStop

    ) {


      return;

    }


    const requestId =
      ++routeSearchRequestId;


    clearRoutePolyline();


    clearRouteResults();


    const directRouteMatches =

      ch52Routes
        .map(

        (route) =>

          findDirectRouteMatch(
            route,
            startBusStop,
            destinationBusStop
          )

        )
        .filter(Boolean);


    if (
      directRouteMatches.length === 0
    ) {


      showAllBusStops();


      const noResult =
        document.createElement(
          "div"
        );


      noResult.className =
        "route-no-result";


      noResult.textContent =
        "No direct route found.";


      routeResults.appendChild(
        noResult
      );


      return;

    }


    showBusStopsForRoute(
      directRouteMatches[0].route,
      startBusStop,
      destinationBusStop
    );


    directRouteMatches.forEach(

      (routeMatch) => {


        const route =
          routeMatch.route;


        const result =
          document.createElement(
            "div"
          );


        result.className =
          "route-result";


        const routeNumber =
          document.createElement(
            "div"
          );


        routeNumber.className =
          "route-result-number";


        routeNumber.textContent =
          route.routeNumber;


        const direction =
          document.createElement(
            "div"
          );


        direction.className =
          "route-result-direction";


        direction.textContent =
          `${route.from} → ${route.to}`;


        result.appendChild(
          routeNumber
        );


        result.appendChild(
          direction
        );


        routeResults.appendChild(
          result
        );

      }

    );


    try {


      await showRouteGeometry(
        directRouteMatches[0],
        startBusStop,
        destinationBusStop,
        requestId
      );

    }


    catch (error) {


      if (
        requestId === routeSearchRequestId
      ) {


        console.error(
          "Could not display route geometry.",
          error
        );

      }

    }

  }

);



/* ========================================
   Place Search
======================================== */

const searchInput =
  document.getElementById(
    "place-search"
  );


const searchButton =
  document.getElementById(
    "search-button"
  );


const searchResults =
  document.getElementById(
    "search-results"
  );


let searchMarker =
  null;



/* Red marker for searched place */

const searchPlaceIcon =
  L.icon({

    iconUrl:
      "./assets/images/marker-icon-2x-red.png",

    shadowUrl:
      "./assets/images/marker-shadow.png",

    iconSize:
      [25, 41],

    iconAnchor:
      [12, 41],

    popupAnchor:
      [1, -34],

    shadowSize:
      [41, 41]

  });



async function searchPlace() {


  const query =
    searchInput.value.trim();


  if (
    !query
  ) {

    return;

  }


  searchResults.innerHTML =

    "<div class='search-result'>Searching...</div>";



  try {


    const url =

      "https://nominatim.openstreetmap.org/search"

      +

      "?format=json"

      +

      "&limit=5"

      +

      "&countrycodes=mn"

      +

      "&q="

      +

      encodeURIComponent(
        query
      );


    const response =
      await fetch(
        url
      );


    if (
      !response.ok
    ) {


      throw new Error(
        "Place search failed."
      );

    }


    const data =
      await response.json();


    searchResults.innerHTML =
      "";


    if (
      data.length === 0
    ) {


      searchResults.innerHTML =

        "<div class='search-result'>No results found</div>";


      return;

    }


    data.forEach(

      (place) => {


        const item =
          document.createElement(
            "div"
          );


        item.className =
          "search-result";


        item.textContent =
          place.display_name;


        item.addEventListener(

          "click",

          () => {


            const lat =
              parseFloat(
                place.lat
              );


            const lon =
              parseFloat(
                place.lon
              );


            map.setView(

              [
                lat,
                lon
              ],

              16

            );


            if (
              searchMarker
            ) {


              map.removeLayer(
                searchMarker
              );

            }


            searchMarker =

              L.marker(
                [
                  lat,
                  lon
                ],
                {
                  icon:
                    searchPlaceIcon
                }
              )

                .addTo(map)

                .bindPopup(
                  place.display_name
                )

                .openPopup();


            searchResults.innerHTML =
              "";

          }

        );


        searchResults.appendChild(
          item
        );

      }

    );

  }


  catch (error) {


    console.error(
      error
    );


    searchResults.innerHTML =

      "<div class='search-result'>Search failed</div>";

  }

}



searchButton.addEventListener(

  "click",

  searchPlace

);


searchInput.addEventListener(

  "keydown",

  (event) => {


    if (
      event.key === "Enter"
    ) {


      searchPlace();

    }

  }

);
