/* ========================================
   Translations
======================================== */

const translations = {

  en: {
    searchPlace: "Search place...",
    searchPlaceButton: "Search place",
    startLabel: "Start:",
    destinationLabel: "Destination:",
    busStopPlaceholder: "select a map pin or Enter bus stop name",
    searchRoutes: "Search Routes",
    setAsStart: "Set as Start",
    setAsDestination: "Set as Destination",
    unnamedBusStop: "Unnamed Bus Stop",
    noBusStopsFound: "No bus stops found",
    routeDataLoadError: "Route data could not be loaded.",
    noDirectRoute: "No direct route found.",
    searching: "Searching...",
    noPlaceResults: "No results found",
    placeSearchFailed: "Search failed",
    currentLocation: "Current Location",
    goToCurrentLocation: "Go to current location",
    showBusStops: "Show bus stops",
    hideBusStops: "Hide bus stops",
    openRouteSearch: "Open route search",
    closeRouteSearch: "Close route search",
    backToRouteSearch: "Back to route search",
    switchLanguage: "Switch to Mongolian",
    busStopDataLoadError: "Could not load bus stop data."
  },

  mn: {
    searchPlace: "Газар хайх...",
    searchPlaceButton: "Газар хайх",
    startLabel: "Эхлэх:",
    destinationLabel: "Очих газар:",
    busStopPlaceholder: "Газрын зураг эсвэл буудлын нэрээс сонгоно уу",
    searchRoutes: "Маршрут хайх",
    setAsStart: "Эхлэх цэг болгох",
    setAsDestination: "Очих цэг болгох",
    unnamedBusStop: "Нэргүй автобусны буудал",
    noBusStopsFound: "Автобусны буудал олдсонгүй",
    routeDataLoadError: "Маршрутын өгөгдлийг ачаалж чадсангүй.",
    noDirectRoute: "Шууд маршрут олдсонгүй.",
    searching: "Хайж байна...",
    noPlaceResults: "Илэрц олдсонгүй",
    placeSearchFailed: "Хайлт амжилтгүй боллоо",
    currentLocation: "Одоогийн байршил",
    goToCurrentLocation: "Одоогийн байршил руу очих",
    showBusStops: "Автобусны буудлуудыг харуулах",
    hideBusStops: "Автобусны буудлуудыг нуух",
    openRouteSearch: "Маршрут хайлтыг нээх",
    closeRouteSearch: "Маршрут хайлтыг хаах",
    backToRouteSearch: "Маршрут хайлт руу буцах",
    switchLanguage: "Англи хэл рүү шилжих",
    busStopDataLoadError: "Автобусны буудлын өгөгдлийг ачаалж чадсангүй."
  }

};


let currentLanguage =
  "en";


function translate(
  key
) {


  return (
    translations[currentLanguage][key] ||
    translations.en[key] ||
    key
  );

}


function updateTranslatedElements(
  root = document
) {


  root.querySelectorAll(
    "[data-i18n]"
  ).forEach(

    (element) => {


      element.textContent =
        translate(
          element.dataset.i18n
        );

    }

  );


  root.querySelectorAll(
    "[data-i18n-placeholder]"
  ).forEach(

    (element) => {


      element.placeholder =
        translate(
          element.dataset.i18nPlaceholder
        );

    }

  );


  root.querySelectorAll(
    "[data-i18n-aria-label]"
  ).forEach(

    (element) => {


      element.setAttribute(
        "aria-label",
        translate(
          element.dataset.i18nAriaLabel
        )
      );

    }

  );

}


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


let routesData =
  null;


let routesDataPromise =
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



async function loadRoutesData() {


  if (
    routesData
  ) {


    return routesData;

  }


  if (
    !routesDataPromise
  ) {


    routesDataPromise =
      fetch(
        "./data/routes/routes-osm.json"
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


            return data.routes;

          }

        );

  }


  try {


    routesData =
      await routesDataPromise;


    return routesData;

  }


  catch (error) {


    routesDataPromise =
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
      L.latLng(stop.lat, stop.lng)
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
      deltaX * deltaX + deltaY * deltaY;


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
      Math.pow(stopPoint.x - projectedPoint.x, 2) +
      Math.pow(stopPoint.y - projectedPoint.y, 2);


    if (
      !closestPoint ||
      distanceSquared < closestPoint.distanceSquared
    ) {


      const latLng =
        L.CRS.EPSG3857.unproject(
          projectedPoint
        );


      closestPoint = {
        segmentIndex: index,
        position: position,
        distanceSquared: distanceSquared,
        coordinate: [latLng.lat, latLng.lng]
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
          L.latLng(coordinate[0], coordinate[1])
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
    (coordinate, index) =>
      index === 0 ||
      coordinate[0] !== segmentCoordinates[index - 1][0] ||
      coordinate[1] !== segmentCoordinates[index - 1][1]
  );

}



function showRouteGeometry(
  route,
  startStop,
  destinationStop,
  requestId
) {


  if (
    requestId !== routeSearchRequestId
  ) {


    return;

  }


  if (
    !Array.isArray(
      route.coordinates
    ) ||

    route.coordinates.length < 2
  ) {


    throw new Error(
      `Route geometry not found: ${route.relationId}`
    );

  }


  const segmentCoordinates =
    getRouteSegmentCoordinates(
      route.coordinates,
      startStop,
      destinationStop
    );


  clearRoutePolyline();


  routePolyline =
    L.featureGroup([

      L.polyline(

        route.coordinates,

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



let currentLocationMarker =
  null;


const currentLocationOptions = {

  enableHighAccuracy: true,

  timeout: 10000,

  maximumAge: 0

};


function showCurrentLocation(
  position
) {


  const lat =
    position.coords.latitude;


  const lng =
    position.coords.longitude;


  if (
    currentLocationMarker
  ) {


    currentLocationMarker.setLatLng(
      [lat, lng]
    );

  }


  else {


    currentLocationMarker =
      L.marker(
        [lat, lng],
        {
          icon:
            currentLocationIcon
        }
      )
        .addTo(map)
        .bindPopup(
          translate(
            "currentLocation"
          )
        );

  }


  map.setView(
    [lat, lng],
    16
  );

}


function handleCurrentLocationError(
  error
) {


  console.error(

    "Could not get current location.",

    error

  );

}


function requestCurrentLocation() {


  navigator.geolocation.getCurrentPosition(

    showCurrentLocation,

    handleCurrentLocationError,

    currentLocationOptions

  );

}


const currentLocationButton =
  document.getElementById(
    "current-location-button"
  );


currentLocationButton.addEventListener(

  "click",

  requestCurrentLocation

);


requestCurrentLocation();



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


const unreachableBusStopIcon =
  L.divIcon({

    className: "",

    html:
      '<div class="bus-stop-marker unreachable">B</div>',

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


let focusedBusStop =
  null;


let activeRouteStartStop =
  null;


let activeRouteDestinationStop =
  null;


let reachableBusStopNodeIds =
  null;


let reachableBusStopsRequestId =
  0;



function isHighlightedBusStop(
  stop
) {


  return (

    stop === focusedBusStop ||

    stop === startBusStop ||

    stop === destinationBusStop ||

    stop === activeRouteStartStop ||

    stop === activeRouteDestinationStop

  );

}



function updateBusStopMarkerIcon(
  stop
) {


  if (
    !stop ||
    !stop.marker
  ) {


    return;

  }


  let markerIcon =
    busStopIcon;


  let zIndexOffset =
    0;


  const hasReachableState =
    startBusStop &&
    reachableBusStopNodeIds instanceof Set;


  const isReachableBusStop =
    hasReachableState &&
    stop.nodeIds.some(

      (nodeId) =>
        reachableBusStopNodeIds.has(
          nodeId
        )

    );


  if (
    isHighlightedBusStop(stop)
  ) {


    markerIcon =
      routeEndpointBusStopIcon;


    zIndexOffset =
      3000;

  }


  else if (
    !routeResultsMode &&
    hasReachableState &&
    !isReachableBusStop
  ) {


    markerIcon =
      unreachableBusStopIcon;

  }


  else if (
    isReachableBusStop
  ) {


    zIndexOffset =
      2000;

  }


  stop.marker.setIcon(
    markerIcon
  );


  stop.marker.setZIndexOffset(
    zIndexOffset
  );

}



function refreshBusStopMarkerIcons() {


  busStops.forEach(

    (stop) => {


      updateBusStopMarkerIcon(
        stop
      );

    }

  );

}



function clearReachableBusStopState() {


  reachableBusStopsRequestId++;


  reachableBusStopNodeIds =
    null;


  refreshBusStopMarkerIcons();

}



async function updateReachableBusStopsForStart(
  selectedStartStop = startBusStop
) {


  const requestId =
    ++reachableBusStopsRequestId;


  reachableBusStopNodeIds =
    null;


  refreshBusStopMarkerIcons();


  if (
    !selectedStartStop ||
    startBusStop !== selectedStartStop
  ) {


    return;

  }


  let routes;


  try {


    routes =
      await loadRoutesData();

  }


  catch (error) {


    if (
      requestId !== reachableBusStopsRequestId ||
      startBusStop !== selectedStartStop
    ) {


      return;

    }


    reachableBusStopNodeIds =
      null;


    refreshBusStopMarkerIcons();


    console.error(
      "Could not calculate directly reachable bus stops.",
      error
    );


    return;

  }


  if (
    requestId !== reachableBusStopsRequestId ||
    startBusStop !== selectedStartStop
  ) {


    return;

  }


  const reachableNodeIds =
    new Set();


  routes.forEach(

    (route) => {


      selectedStartStop.nodeIds.forEach(

        (startNodeId) => {


          const startIndex =
            route.stops.indexOf(
              startNodeId
            );


          if (
            startIndex === -1
          ) {


            return;

          }


          route.stops
            .slice(
              startIndex + 1
            )
            .forEach(

              (nodeId) => {


                reachableNodeIds.add(
                  nodeId
                );

              }

            );

        }

      );

    }

  );


  if (
    requestId !== reachableBusStopsRequestId ||
    startBusStop !== selectedStartStop
  ) {


    return;

  }


  reachableBusStopNodeIds =
    reachableNodeIds;


  refreshBusStopMarkerIcons();

}



function setFocusedBusStop(
  stop
) {


  const previousFocusedBusStop =
    focusedBusStop;


  focusedBusStop =
    stop;


  if (
    previousFocusedBusStop &&
    previousFocusedBusStop !== stop
  ) {


    updateBusStopMarkerIcon(
      previousFocusedBusStop
    );

  }


  updateBusStopMarkerIcon(
    stop
  );

}



function clearFocusedBusStop(
  stop
) {


  if (
    focusedBusStop !== stop
  ) {


    return;

  }


  focusedBusStop =
    null;


  updateBusStopMarkerIcon(
    stop
  );

}


function showAllBusStops() {


  activeRouteStartStop =
    null;


  activeRouteDestinationStop =
    null;


  busStopLayer.clearLayers();


  busStops.forEach(

    (stop) => {


      if (
        stop.marker
      ) {


        updateBusStopMarkerIcon(
          stop
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


  activeRouteStartStop =
    startStop;


  activeRouteDestinationStop =
    destinationStop;


  const platformIds =
    new Set(
      route.stops
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


        updateBusStopMarkerIcon(
          stop
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

        translate(
          "showBusStops"
        )

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

        translate(
          "hideBusStops"
        )

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

        translate(
          "openRouteSearch"
        )

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

        translate(
          "closeRouteSearch"
        )

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


const routeSearchForm =
  document.getElementById(
    "route-search-form"
  );


const routeResultsHeader =
  document.getElementById(
    "route-results-header"
  );


const routeResultsSummary =
  document.getElementById(
    "route-results-summary"
  );


const routeBackButton =
  document.getElementById(
    "route-back-button"
  );


let routeResultsMode =
  false;


const languageToggle =
  document.getElementById(
    "language-toggle"
  );


const languageToggleFlag =
  document.getElementById(
    "language-toggle-flag"
  );


const languageToggleCode =
  document.getElementById(
    "language-toggle-code"
  );


function applyLanguage() {


  document.documentElement.lang =
    currentLanguage;


  updateTranslatedElements();


  busStops.forEach(

    (stop) => {


      const popupContent =
        stop.marker
          ?.getPopup()
          ?.getContent();


      if (
        popupContent instanceof Element
      ) {


        updateTranslatedElements(
          popupContent
        );

      }

    }

  );


  languageToggleFlag.textContent =
    currentLanguage === "en"

      ? "🇬🇧"

      : "🇲🇳";


  languageToggleCode.textContent =
    currentLanguage === "en"

      ? "EN"

      : "MN";


  languageToggle.setAttribute(
    "aria-label",
    translate(
      "switchLanguage"
    )
  );


  currentLocationButton.setAttribute(
    "aria-label",
    translate(
      "goToCurrentLocation"
    )
  );


  busStopToggle.setAttribute(
    "aria-label",
    translate(
      busStopsVisible

        ? "hideBusStops"

        : "showBusStops"
    )
  );


  panelToggle.setAttribute(
    "aria-label",
    translate(
      routePanelOpen

        ? "closeRouteSearch"

        : "openRouteSearch"
    )
  );


  routeBackButton.setAttribute(
    "aria-label",
    translate(
      "backToRouteSearch"
    )
  );


  if (
    currentLocationMarker
  ) {


    currentLocationMarker.setPopupContent(
      translate(
        "currentLocation"
      )
    );

  }

}


languageToggle.addEventListener(

  "click",

  () => {


    currentLanguage =
      currentLanguage === "en"

        ? "mn"

        : "en";


    applyLanguage();

  }

);



function clearRouteResults() {


  routeResults.innerHTML =
    "";

}



function setRouteResultsMode(
  enabled,
  startStop = startBusStop,
  destinationStop = destinationBusStop
) {


  routeResultsMode =
    enabled;


  routeSearchForm.hidden =
    enabled;


  routeResultsHeader.hidden =
    !enabled;


  routePanel.classList.toggle(
    "results-mode",
    enabled
  );


  routeResultsSummary.textContent =

    enabled &&
    startStop &&
    destinationStop

      ? `${startStop.displayName} → ${destinationStop.displayName}`

      : "";


  refreshBusStopMarkerIcons();

}



function returnToRouteSearchMode() {


  routeSearchRequestId++;


  clearRoutePolyline();


  showAllBusStops();


  clearRouteResults();


  setRouteResultsMode(
    false
  );


  updateRouteSearchButton();

}



routeBackButton.addEventListener(

  "click",

  returnToRouteSearchMode

);



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


  const previousBusStop =

    type === "start"

      ? startBusStop

      : destinationBusStop;


  if (
    routeResultsMode
  ) {


    returnToRouteSearchMode();

  }


  else {


    clearRouteResults();

  }


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


  updateBusStopMarkerIcon(
    previousBusStop
  );


  updateBusStopMarkerIcon(
    stop
  );


  if (
    type === "start"
  ) {


    updateReachableBusStopsForStart(
      stop
    );

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

          translate(
            "unnamedBusStop"
          );



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


        startButton.dataset.i18n =
          "setAsStart";


        startButton.textContent =
          translate(
            "setAsStart"
          );


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


        destinationButton.dataset.i18n =
          "setAsDestination";


        destinationButton.textContent =
          translate(
            "setAsDestination"
          );


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


        stop.marker =
          marker;


        marker

          .addTo(
            busStopLayer
          )

          .bindPopup(
            popup
          );


        marker.on(

          "popupopen",

          () => {


            setFocusedBusStop(
              stop
            );

          }

        );


        marker.on(

          "popupclose",

          () => {


            clearFocusedBusStop(
              stop
            );

          }

        );


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

      translate(
        "busStopDataLoadError"
      )

      +

      "\n"

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


    noResult.dataset.i18n =
      "noBusStopsFound";


    noResult.textContent =
      translate(
        "noBusStopsFound"
      );


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


      clearReachableBusStopState();


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


      const previousDestinationBusStop =
        destinationBusStop;


      destinationBusStop =
        null;


      updateBusStopMarkerIcon(
        previousDestinationBusStop
      );


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
        route.stops.indexOf(
          startNodeId
        );


      const destinationIndex =
        route.stops.indexOf(
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


    const selectedStartStop =
      startBusStop;


    const selectedDestinationStop =
      destinationBusStop;


    const requestId =
      ++routeSearchRequestId;


    clearRoutePolyline();


    showAllBusStops();


    clearRouteResults();


    routeSearchButton.disabled =
      true;


    let routes;


    try {


      routes =
        await loadRoutesData();

    }


    catch (error) {


      if (
        requestId !== routeSearchRequestId
      ) {


        return;

      }


      const errorResult =
        document.createElement(
          "div"
        );


      errorResult.className =
        "route-no-result";


      errorResult.dataset.i18n =
        "routeDataLoadError";


      errorResult.textContent =
        translate(
          "routeDataLoadError"
        );


      routeResults.appendChild(
        errorResult
      );


      console.error(
        "Could not load route data.",
        error
      );


      updateRouteSearchButton();


      return;

    }


    if (

      requestId !== routeSearchRequestId ||

      startBusStop !== selectedStartStop ||

      destinationBusStop !== selectedDestinationStop

    ) {


      updateRouteSearchButton();


      return;

    }


    const directRouteMatches =

      routes
        .map(

          (route) =>

            findDirectRouteMatch(
              route,
              selectedStartStop,
              selectedDestinationStop
            )

        )
        .filter(Boolean)
        .sort(

          (left, right) =>
            left.route.ref.localeCompare(
              right.route.ref,
              undefined,
              {
                numeric: true,
                sensitivity: "base"
              }
            )

            ||

            left.route.relationId -
              right.route.relationId

        );


    setRouteResultsMode(
      true,
      selectedStartStop,
      selectedDestinationStop
    );


    if (
      directRouteMatches.length === 0
    ) {


      const noResult =
        document.createElement(
          "div"
        );


      noResult.className =
        "route-no-result";


      noResult.dataset.i18n =
        "noDirectRoute";


      noResult.textContent =
        translate(
          "noDirectRoute"
        );


      routeResults.appendChild(
        noResult
      );


      updateRouteSearchButton();


      return;

    }


    const resultItems =
      [];


    const selectRouteResult =
      (routeMatch, selectedResult) => {


        if (
          requestId !== routeSearchRequestId
        ) {


          return;

        }


        resultItems.forEach(

          (item) => {


            const isSelected =
              item.element === selectedResult;


            item.element.classList.toggle(
              "selected",
              isSelected
            );


            item.element.setAttribute(
              "aria-pressed",
              String(isSelected)
            );

          }

        );


        showBusStopsForRoute(
          routeMatch.route,
          selectedStartStop,
          selectedDestinationStop
        );


        try {


          showRouteGeometry(
            routeMatch.route,
            selectedStartStop,
            selectedDestinationStop,
            requestId
          );

        }


        catch (error) {


          console.error(
            "Could not display route geometry.",
            error
          );

        }

      };


    directRouteMatches.forEach(

      (routeMatch) => {


        const route =
          routeMatch.route;


        const result =
          document.createElement(
            "button"
          );


        result.type =
          "button";


        result.className =
          "route-result";


        result.setAttribute(
          "aria-pressed",
          "false"
        );


        const routeNumber =
          document.createElement(
            "div"
          );


        routeNumber.className =
          "route-result-number";


        routeNumber.textContent =
          route.ref;


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


        result.addEventListener(

          "click",

          () => {


            selectRouteResult(
              routeMatch,
              result
            );

          }

        );


        routeResults.appendChild(
          result
        );


        resultItems.push({
          element: result,
          routeMatch: routeMatch
        });

      }

    );


    selectRouteResult(
      resultItems[0].routeMatch,
      resultItems[0].element
    );


    updateRouteSearchButton();

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


function showPlaceSearchStatus(
  translationKey
) {


  searchResults.innerHTML =
    "";


  const status =
    document.createElement(
      "div"
    );


  status.className =
    "search-result";


  status.dataset.i18n =
    translationKey;


  status.textContent =
    translate(
      translationKey
    );


  searchResults.appendChild(
    status
  );

}



async function searchPlace() {


  const query =
    searchInput.value.trim();


  if (
    !query
  ) {

    return;

  }


  showPlaceSearchStatus(
    "searching"
  );



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


      showPlaceSearchStatus(
        "noPlaceResults"
      );


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


    showPlaceSearchStatus(
      "placeSearchFailed"
    );

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


applyLanguage();
