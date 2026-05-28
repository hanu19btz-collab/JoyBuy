const ORS_API_KEY =
    "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImJiNjA4OTQ4OWI2MTQzMmJhOTUzYWJjY2M5ODNlMzdiIiwiaCI6Im11cm11cjY0In0=";




let currentDepot =
    DEPOTS.LE11;
// ======================================
// MAP
// ======================================

const map =
    L.map('map')
    .setView([54.5, -3], 6);

L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        attribution:
            '&copy; OpenStreetMap contributors'
    }
).addTo(map);

// ======================================
// DATA
// ======================================

let stopsData = [];

let markers = [];

let polylines = [];

let routeLayers = {};

let routeCache = {};

let routeSummaries = {};

let movedStops = {};
let hiddenRoutes = [];

// ======================================
// ELEMENTS
// ======================================

const uploadBtn =
    document.getElementById(
        'uploadBtn'
    );

const exportBtn =
    document.getElementById(
        'exportBtn'
    );

const addStopBtn =
    document.getElementById(
        'addStopBtn'
    );

const depotSelector =
    document.getElementById(
        'depotSelector'
    );
    const saveSessionBtn =
    document.getElementById(
        'saveSessionBtn'
    );

const savedSessionsContainer =
    document.getElementById(
        'savedSessions'
    );
// ======================================
// BUTTON EVENTS
// ======================================

exportBtn.addEventListener(
    'click',
    exportRoutes
);
saveSessionBtn.addEventListener(
    'click',
    saveCurrentSession
);
// ======================================
// NORMALIZE ROUTE
// ======================================

function normalizeRouteName(
    route
) {

    if (!route) {
        return "Route 1";
    }

    const clean =
        route
        .trim()
        .toLowerCase();

    if (clean.includes("1")) {
        return "Route 1";
    }

    if (clean.includes("2")) {
        return "Route 2";
    }

    if (clean.includes("3")) {
        return "Route 3";
    }

    if (clean.includes("4")) {
        return "Route 4";
    }

    if (clean.includes("5")) {
        return "Route 5";
    }

    if (clean.includes("6")) {
        return "Route 6";
    }

    return "Route 1";
}


// ======================================
// DEPOT CHANGE
// ======================================

depotSelector.addEventListener(
    'change',
    async () => {

        currentDepot =
            DEPOTS[
                depotSelector.value
            ];

        await renderMap();

        renderSidebar();
    }
);


// ======================================
// UPLOAD
// ======================================

uploadBtn.addEventListener(
    'click',
    async () => {

        const fileInput =
            document.getElementById(
                'excelFile'
            );

        const file =
            fileInput.files[0];

        if (!file) {

            alert(
                "Select Excel file."
            );

            return;
        }

        uploadBtn.innerText =
            "Loading...";

        uploadBtn.disabled = true;

        clearMap();
        routeCache = {};

        movedStops = {};

        const formData =
            new FormData();

        formData.append(
            'file',
            file
        );

        try {

            const response =
    await fetch(
        `https://joybuy-backend1.onrender.com/upload?depot=${currentDepot.id}`,
                    {
                        method: 'POST',
                        body: formData
                    }
                );

            stopsData =
                await response.json();

            stopsData.forEach(
                stop => {

                    stop.id =
                        crypto.randomUUID();

                    stop.redelivery =
                        false;

                    stop.route =
                        normalizeRouteName(
                            stop.route
                        );

                    stop.color =
                        ROUTE_COLORS[
                            stop.route
                        ] || "gray";
                }
            );

            await renderMap();

            renderSidebar();

        } catch (err) {

            console.error(err);

            alert(
                "Upload error."
            );
        }

        uploadBtn.innerText =
            "Generate Routes";

        uploadBtn.disabled = false;
    }
);


// ======================================
// ADD STOP
// ======================================

addStopBtn.addEventListener(
    'click',
    async () => {

        const postcode =
            prompt(
                "Enter postcode"
            );

        if (!postcode) {
            return;
        }

        const stopType =
            prompt(
                "Enter NORMAL or REDELIVERY"
            );

        const isRedelivery =
            stopType &&
            stopType
                .trim()
                .toUpperCase() ===
            "REDELIVERY";

        let selectedRoute =
            prompt(
                "Choose Route:\n\nRoute 1\nRoute 2\nRoute 3\nRoute 4\nRoute 5\nRoute 6"
            );

        selectedRoute =
            normalizeRouteName(
                selectedRoute
            );

        const routeStops =
            stopsData.filter(
                x => x.route === selectedRoute
            );

        const selectedPosition =
            parseInt(
                prompt(
                    `Enter position (1-${routeStops.length + 1})`
                )
            );

        if (
            !selectedPosition ||
            selectedPosition < 1
        ) {

            return;
        }

        try {

            const response =
                await fetch(
                    `https://api.postcodes.io/postcodes/${postcode.replace(/\s/g, '')}`
                );

            const data =
                await response.json();
console.log(data);
            if (
                data.status !== 200
            ) {

                alert(
                    "Invalid postcode"
                );

                return;
            }

            const result =
                data.result;

            const newStop = {

                id:
                    crypto.randomUUID(),

                postcode:
                    postcode.toUpperCase(),

                lat:
                    result.latitude,

                lng:
                    result.longitude,

                route:
                    selectedRoute,

                color:
                    ROUTE_COLORS[
                        selectedRoute
                    ],

                redelivery:
                    isRedelivery
            };

            let insertIndex = 0;

            let count = 0;

            for (
                let i = 0;
                i < stopsData.length;
                i++
            ) {

                if (
                    stopsData[i].route ===
                    selectedRoute
                ) {

                    if (
                        count ===
                        selectedPosition - 1
                    ) {

                        insertIndex = i;

                        break;
                    }

                    count++;
                }

                insertIndex = i + 1;
            }

            stopsData.splice(
                insertIndex,
                0,
                newStop
            );
            delete routeCache[
    selectedRoute
];

            await renderMap();

            renderSidebar();

        } catch (err) {

            console.error(err);

            alert(
                "Error adding stop"
            );
        }
    }
);


// ======================================
// CLEAR MAP
// ======================================

function clearMap() {

    markers.forEach(m =>
        map.removeLayer(m)
    );

    polylines.forEach(p =>
        map.removeLayer(p)
    );

    markers = [];

    polylines = [];

    routeSummaries = {};
}


// ======================================
// RENDER MAP
// ======================================

async function renderMap() {

    clearMap();

    const bounds = [];

    const groupedRoutes = {};

    const depotMarker = L.marker(
        [
            currentDepot.lat,
            currentDepot.lng
        ]
    )
    .addTo(map)
    .bindPopup(`
        <b>${currentDepot.name}</b><br>
        ${currentDepot.postcode}
    `);

    markers.push(depotMarker);

    bounds.push([
        currentDepot.lat,
        currentDepot.lng
    ]);

    stopsData.forEach(
    stop => {

        if (
            !stop.lat ||
            !stop.lng
        ) {
            return;
        }
        if (
    hiddenRoutes.includes(
    normalizeRouteName(
        stop.route
    )
)
) {
    return;
}

       

            const routeStops =
                stopsData.filter(
                    x => x.route === stop.route
                );

            const stopNumber =
                routeStops.findIndex(
                    x => x.id === stop.id
                ) + 1;

            const icon =
                L.divIcon({

                    className: '',

                    html: `

                        <div style="
                            position:relative;
                            width:34px;
                            height:34px;
                        ">

                            ${
                                stop.redelivery
                                ? `
                                <div style="
                                    position:absolute;
                                    top:-10px;
                                    left:10px;
                                    background:red;
                                    color:white;
                                    width:16px;
                                    height:16px;
                                    border-radius:50%;
                                    font-size:11px;
                                    font-weight:bold;
                                    display:flex;
                                    align-items:center;
                                    justify-content:center;
                                    z-index:999;
                                ">
                                    R
                                </div>
                                `
                                : ''
                            }

                            <div style="
                                background:${stop.color};
                                width:30px;
                                height:30px;
                                border-radius:50%;
                                border:2px solid white;
                                box-shadow:0 0 4px rgba(0,0,0,0.5);

                                display:flex;
                                align-items:center;
                                justify-content:center;

                                color:white;
                                font-weight:bold;
                                font-size:13px;
                            ">

                                ${stopNumber}

                            </div>

                        </div>
                    `,

                    iconSize: [34, 34]
                });

            const marker =
    L.marker(
        [
            stop.lat,
            stop.lng
        ],
        { icon }
    ).addTo(map);

marker.routeName =
    stop.route;

            marker.bindPopup(
                createPopup(stop.id)
            );

            marker.on(
                'popupopen',
                () => {

                    updatePositionOptions(
                        stop.id
                    );
                }
            );

            markers.push(marker);

            bounds.push([
                stop.lat,
                stop.lng
            ]);

            if (
                !groupedRoutes[
                    stop.route
                ]
            ) {

                groupedRoutes[
                    stop.route
                ] = [];
            }

            groupedRoutes[
                stop.route
            ].push(stop);
        }
    );

    for (
        const [route, stops]
        of Object.entries(
            groupedRoutes
        )
    ) {
     

        const sampleStop =
            stopsData.find(
                x => x.route === route
            );

        await drawRealRoute(
            route,
            stops,
            sampleStop?.color ||
            "gray"
        );
    }

    if (bounds.length > 0) {

        map.fitBounds(bounds);
    }
}


// ======================================
// DRAW ROUTE
// ======================================

async function drawRealRoute(
    routeName,
    stops,
    color
) {

    if (stops.length < 1) {
        return;
    }

    try {
        const cacheKey =
    JSON.stringify(

        stops.map(
            x => x.id
        )
    );

const cached =
    routeCache[
        routeName
    ];

if (

    cached &&

    cached.key ===
    cacheKey

) {

    routeLayers[
        routeName
    ] =
        cached.layer;

    cached.layer.addTo(map);

    polylines.push(
        cached.layer
    );

    return;
}

        const coordinates = [

            [
                currentDepot.lng,
                currentDepot.lat
            ]
        ];

        stops.forEach(stop => {

            coordinates.push([
                stop.lng,
                stop.lat
            ]);
        });

        coordinates.push([
            currentDepot.lng,
            currentDepot.lat
        ]);

        const response =
            await fetch(
                'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
                {

                    method: 'POST',

                    headers: {

                        'Authorization':
                            ORS_API_KEY,

                        'Content-Type':
                            'application/json'
                    },

                    body: JSON.stringify({

                        coordinates:
                            coordinates,

                        instructions: false,

                        preference:
                            "recommended"
                    })
                }
            );

            const data =
                await response.json();

            if (
                !data.features ||
                !data.features.length
            ) {
                return;
            }

            const routeLayer =
                L.geoJSON(data, {

                    style: {

                        color: color,

                        weight: 5,

                        opacity: 0.8
                    }

                }).addTo(map);

            polylines.push(routeLayer);

            routeLayers[routeName] =
    routeLayer;
    routeCache[
    routeName
] = {

    key:
        cacheKey,

    layer:
        routeLayer
};

            const summary =
                data.features[0]
                    .properties
                    .summary;

            const distanceMiles =
                (
                    summary.distance *
                    0.000621371
                ).toFixed(1);

            const totalMinutes =
                Math.round(
                    summary.duration / 60
                );

            const hours =
                Math.floor(
                    totalMinutes / 60
                );

            const minutes =
                totalMinutes % 60;

            const formattedTime =
                `${hours}h ${minutes}m`;

            routeSummaries[
                routeName
            ] = {

                distance:
                    distanceMiles,

                duration:
                    formattedTime
            };

    } catch (err) {

        console.error(err);
    }
}


// ======================================
// POPUP
// ======================================

function createPopup(stopId) {

    const stop =
        stopsData.find(
            x => x.id === stopId
        );

    return `
        <div style="
            min-width:240px;
        ">

            <b style="
                font-size:20px;
            ">
                ${stop.postcode}
            </b>

            <br><br>

            Current Route:
            <b>${stop.route}</b>
<br><br>

Parcels:
<b>${stop.parcels || 0}</b>

<br><br>

<div style="
    max-height:120px;
    overflow-y:auto;
    background:#f3f4f6;
    padding:8px;
    border-radius:8px;
    font-size:12px;
">

    <b>JDW Numbers</b>

    <br><br>

    ${
        stop.jdwNumbers &&
        stop.jdwNumbers.length > 0

        ? stop.jdwNumbers.join('<br>')

        : 'No JDW Numbers'
    }

</div>

<br><br>
            <br><br>

            <label>
                Route
            </label>

            <br>

            <select
                id="routeSelect${stopId}"
                onchange="
                    updatePositionOptions('${stopId}')
                "
                style="
                    width:100%;
                    margin-top:4px;
                    margin-bottom:12px;
                    padding:6px;
                "
            >

                ${getRouteOptions(
                    stop.route
                )}

            </select>

            <label>
                Position
            </label>

            <br>

            <select
                id="positionSelect${stopId}"
                style="
                    width:100%;
                    margin-top:4px;
                    margin-bottom:14px;
                    padding:6px;
                "
            >
            </select>

            <button
                onclick="
                    moveStopToPosition('${stopId}')
                "
                style="
                    width:100%;
                    padding:10px;
                    background:#4f5fe3;
                    color:white;
                    border:none;
                    border-radius:8px;
                    font-weight:bold;
                    cursor:pointer;
                "
            >
                Move Stop
            </button>

        </div>
    `;
}


// ======================================
// ROUTE OPTIONS
// ======================================

function getRouteOptions(
    currentRoute
) {

    const fixedRoutes = [

        "Route 1",
        "Route 2",
        "Route 3",
        "Route 4",
        "Route 5",
        "Route 6"
    ];

    return fixedRoutes.map(
        route => `
            <option
                value="${route}"
                ${route === currentRoute ? 'selected' : ''}
            >
                ${route}
            </option>
        `
    ).join('');
}


// ======================================
// POSITION OPTIONS
// ======================================

window.updatePositionOptions =
function(stopId) {

    const routeSelect =
        document.getElementById(
            `routeSelect${stopId}`
        );

    const positionSelect =
        document.getElementById(
            `positionSelect${stopId}`
        );

    const selectedRoute =
        routeSelect.value;

    const routeStops =
        stopsData.filter(
            x => x.route === selectedRoute
        );

    positionSelect.innerHTML = '';

    let currentPosition = 1;

    for (
        let i = 0;
        i < routeStops.length;
        i++
    ) {

        if (
            routeStops[i].id === stopId
        ) {

            currentPosition =
                i + 1;

            break;
        }
    }

    for (
        let i = 1;
        i <= routeStops.length + 1;
        i++
    ) {

        positionSelect.innerHTML += `

            <option
                value="${i}"
                ${i === currentPosition ? 'selected' : ''}
            >
                ${i}
            </option>

        `;
    }
};


// ======================================
// MOVE STOP
// ======================================

window.moveStopToPosition =
async function(stopId) {

    const routeSelect =
        document.getElementById(
            `routeSelect${stopId}`
        );

    const positionSelect =
        document.getElementById(
            `positionSelect${stopId}`
        );

    let newRoute =
        routeSelect.value;

    newRoute =
        normalizeRouteName(
            newRoute
        );

    const newPosition =
        parseInt(
            positionSelect.value
        ) - 1;

    const stop =
        stopsData.find(
            x => x.id === stopId
        );

    const oldRoute =
        stop.route;

    const currentIndex =
        stopsData.findIndex(
            x => x.id === stopId
        );

    stopsData.splice(
        currentIndex,
        1
    );

    stop.route = newRoute;

    stop.color =
        ROUTE_COLORS[
            newRoute
        ];

    let insertIndex = 0;

    let count = 0;

    for (
        let i = 0;
        i < stopsData.length;
        i++
    ) {

        if (
            stopsData[i].route ===
            newRoute
        ) {

            if (
                count === newPosition
            ) {

                insertIndex = i;

                break;
            }

            count++;
        }

        insertIndex = i + 1;
    }

    stopsData.splice(
        insertIndex,
        0,
        stop
    );

    if (oldRoute !== newRoute) {

        if (
    movedStops[
        stop.postcode
    ]
) {

    movedStops[
        stop.postcode
    ].finalRoute =
        newRoute;

    movedStops[
        stop.postcode
    ].movedAt =
        new Date()
        .toLocaleString();

} else {

    movedStops[
        stop.postcode
    ] = {

        postcode:
            stop.postcode,

        originalRoute:
            oldRoute,

        finalRoute:
            newRoute,

        parcels:
            stop.parcels || 0,

        jdwNumbers:
            stop.jdwNumbers || [],

        movedAt:
            new Date()
            .toLocaleString()
    };
}
    }
    delete routeCache[
    oldRoute
];

delete routeCache[
    newRoute
];
    if (routeLayers[oldRoute]) {

    map.removeLayer(
        routeLayers[oldRoute]
    );

    delete routeLayers[oldRoute];
}

if (routeLayers[newRoute]) {

    map.removeLayer(
        routeLayers[newRoute]
    );

    delete routeLayers[newRoute];
}



    await renderMap();

    renderSidebar();
};


// ======================================
// SIDEBAR
// ======================================

function renderSidebar() {

    const routeStats =
        document.getElementById(
            'routeStats'
        );

    routeStats.innerHTML = '';

    const uniqueRoutes = [

        "Route 1",
        "Route 2",
        "Route 3",
        "Route 4",
        "Route 5",
        "Route 6"
    ];

    uniqueRoutes.forEach(
        route => {

            const count =
                stopsData.filter(
                    x => x.route === route
                ).length;

            const stats =
                routeSummaries[
                    route
                ];

            const card =
                document.createElement(
                    'div'
                );

            card.style.background =
                ROUTE_COLORS[
                    route
                ];

            card.style.color =
                "white";

            card.style.padding =
                "14px";

            card.style.marginBottom =
                "12px";

            card.style.borderRadius =
                "12px";

            card.style.border =
                "3px solid rgba(255,255,255,0.2)";

            card.style.boxShadow =
                "0 2px 8px rgba(0,0,0,0.25)";

            card.innerHTML = `

                <div style="
                    font-size:18px;
                    font-weight:bold;
                    margin-bottom:8px;
                ">
                    ${route}
                </div>

                <div>
                    Stops: ${count}
                </div>

                <div>
                    Distance:
                    ${stats?.distance || '-'} miles
                </div>

                <div>
    Time:
    ${stats?.duration || '-'}
</div>

<br><br>

<label style="
    display:flex;
    align-items:center;
    gap:8px;
    margin-top:10px;
">

    <input
    type="checkbox"
    ${hiddenRoutes.includes(route) ? '' : 'checked'}
    onchange="
        toggleRoute('${route}')
    "
>

    Visible

</label>
            `;

            routeStats.appendChild(
                card
            );
        }
    );
}


// ======================================
// EXPORT ROUTES
// ======================================

function exportRoutes() {

    try {

        const workbook =
            XLSX.utils.book_new();

        const uniqueRoutes = [

            "Route 1",
            "Route 2",
            "Route 3",
            "Route 4",
            "Route 5",
            "Route 6"
        ];

        uniqueRoutes.forEach(
            route => {

                const routeStops =
                    stopsData.filter(
                        x => x.route === route
                    );

                if (
                    routeStops.length === 0
                ) {
                    return;
                }

                const exportData =
                    routeStops.map(
                        (
                            stop,
                            index
                        ) => ({

    Stop_Number:
        index + 1,

    Postcode:
        stop.postcode,

    Route:
        stop.route,

    Parcels:
        stop.parcels || 0,

    JDW_Numbers:
        Array.isArray(
            stop.jdwNumbers
        )

        ? stop.jdwNumbers.join(", ")

        : "",

    Redelivery:
        stop.redelivery
            ? "YES"
            : "NO"
})
                    );

                const worksheet =
                    XLSX.utils.json_to_sheet(
                        exportData
                    );

                XLSX.utils.book_append_sheet(
                    workbook,
                    worksheet,
                    route
                );
            }
        );

        // MANUAL MOVES SHEET
        if (
            Object.keys(
                movedStops
            ).length > 0
        ) {

            const manualMovesData =
                Object.values(
                    movedStops
                );
                const formattedMovesData =
    manualMovesData.map(
        move => ({

            Postcode:
                move.postcode,

            Move_From:
                move.originalRoute,

            Move_To:
                move.finalRoute,

            Parcels:
                move.parcels || 0,

            JDW_Numbers:
                Array.isArray(
                    move.jdwNumbers
                )

                ? move.jdwNumbers.join(", ")

                : "",

            Moved_At:
                move.movedAt
        })
    );

            const movesSheet =
    XLSX.utils.json_to_sheet(
        formattedMovesData
    );

            XLSX.utils.book_append_sheet(
                workbook,
                movesSheet,
                "Manual_Moves"
            );
        }

        XLSX.writeFile(
            workbook,
            "Optimized_Routes.xlsx"
        );

    } catch (err) {

        console.error(err);

        alert(
            "Export failed."
        );
    }
}
// ======================================
// SAVE SESSION
// ======================================

function saveCurrentSession() {

    if (stopsData.length === 0) {

        alert("No routes loaded.");

        return;
    }

    const sessionName =
        prompt(
            "Enter session name"
        );

    if (!sessionName) {
        return;
    }

    const existingSessions =
        JSON.parse(
            localStorage.getItem(
                'joybuy_sessions'
            ) || '[]'
        );

    const sessionData = {

        id:
            crypto.randomUUID(),

        name:
            sessionName,

        depot:
            currentDepot.id,

        createdAt:
            new Date().toLocaleString(),

        stops:
            stopsData,

        movedStops:
            movedStops,
hiddenRoutes:
    hiddenRoutes
    };

    existingSessions.push(
        sessionData
    );

    localStorage.setItem(
        'joybuy_sessions',
        JSON.stringify(
            existingSessions
        )
    );

    renderSavedSessions();

    alert(
        "Session saved."
    );
}
// ======================================
// RENDER SAVED SESSIONS
// ======================================

function renderSavedSessions() {

    const sessions =
        JSON.parse(
            localStorage.getItem(
                'joybuy_sessions'
            ) || '[]'
        );

    savedSessionsContainer.innerHTML = '';

    if (sessions.length === 0) {

        savedSessionsContainer.innerHTML =
            `
            <div style="
                color:gray;
                font-size:14px;
            ">
                No saved sessions
            </div>
            `;

        return;
    }

    sessions.forEach(
        session => {

            const div =
                document.createElement(
                    'div'
                );

            div.style.background =
                'white';

            div.style.padding =
                '12px';

            div.style.borderRadius =
                '10px';

            div.style.marginBottom =
                '10px';

            div.style.boxShadow =
                '0 1px 4px rgba(0,0,0,0.1)';

            div.innerHTML = `

                <div style="
                    font-weight:bold;
                    margin-bottom:6px;
                ">
                    ${session.name}
                </div>

                <div style="
                    font-size:13px;
                    color:gray;
                    margin-bottom:10px;
                ">
                    ${session.createdAt}
                </div>

                <button
                    onclick="loadSession('${session.id}')"
                    style="
                        margin-right:6px;
                        background:#2563eb;
                    "
                >
                    Load
                </button>

                <button
                    onclick="deleteSession('${session.id}')"
                    style="
                        background:#dc2626;
                    "
                >
                    Delete
                </button>
            `;

            savedSessionsContainer.appendChild(
                div
            );
        }
    );
}
// ======================================
// LOAD SESSION
// ======================================

window.loadSession =
async function(sessionId) {

    const sessions =
        JSON.parse(
            localStorage.getItem(
                'joybuy_sessions'
            ) || '[]'
        );

    const session =
        sessions.find(
            x => x.id === sessionId
        );

    if (!session) {
        return;
    }

    currentDepot =
        DEPOTS[
            session.depot
        ];

    depotSelector.value =
        session.depot;

    stopsData =
        session.stops;
        routeCache = {};

    movedStops =
        session.movedStops || {};
hiddenRoutes =
    session.hiddenRoutes || [];
    await renderMap();

    renderSidebar();
}
// ======================================
// DELETE SESSION
// ======================================

window.deleteSession =
function(sessionId) {

    const sessions =
        JSON.parse(
            localStorage.getItem(
                'joybuy_sessions'
            ) || '[]'
        );

    const filtered =
        sessions.filter(
            x => x.id !== sessionId
        );

    localStorage.setItem(
        'joybuy_sessions',
        JSON.stringify(filtered)
    );

    renderSavedSessions();
}
renderSavedSessions();
// ======================================
// TOGGLE ROUTE VISIBILITY
// ======================================

window.toggleRoute =
function(route) {

    route =
        normalizeRouteName(route);

    const isHidden =
        hiddenRoutes.includes(route);

    if (isHidden) {

        hiddenRoutes =
            hiddenRoutes.filter(
                x => x !== route
            );

    } else {

        hiddenRoutes.push(route);
    }

    markers.forEach(marker => {

        if (
            marker.routeName === route
        ) {

            if (isHidden) {

                map.addLayer(marker);

            } else {

                map.removeLayer(marker);
            }
        }
    });

    if (routeLayers[route]) {

    if (isHidden) {

        if (
            !map.hasLayer(
                routeLayers[route]
            )
        ) {

            routeLayers[
                route
            ].addTo(map);
        }

    } else {

        if (
            map.hasLayer(
                routeLayers[route]
            )
        ) {

            map.removeLayer(
                routeLayers[route]
            );
        }
    }
}

    renderSidebar();
}