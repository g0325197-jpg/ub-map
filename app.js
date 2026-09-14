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
      [26, 26],

    iconAnchor:
      [13, 13],

    popupAnchor:
      [0, -13]

  });



/* ========================================
   Bus Stop Layer
======================================== */

const busStopLayer =
  L.layerGroup()
    .addTo(map);


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

function isDirectRoute(
  route,
  startStop,
  destinationStop
) {


  return startStop.nodeIds.some(

    (startNodeId) => {


      return destinationStop.nodeIds.some(

        (destinationNodeId) => {


          const startIndex =
            route.platformIds.indexOf(
              startNodeId
            );


          const destinationIndex =
            route.platformIds.indexOf(
              destinationNodeId
            );


          return (

            startIndex !== -1 &&

            destinationIndex !== -1 &&

            startIndex < destinationIndex

          );

        }

      );

    }

  );

}

routeSearchButton.addEventListener(

  "click",

  () => {


    if (

      !startBusStop ||

      !destinationBusStop

    ) {


      return;

    }


    clearRouteResults();


    const directRoutes =

      ch52Routes.filter(

        (route) =>

          isDirectRoute(
            route,
            startBusStop,
            destinationBusStop
          )

      );


    if (
      directRoutes.length === 0
    ) {


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


    directRoutes.forEach(

      (route) => {


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
