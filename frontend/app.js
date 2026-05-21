const ORS_API_KEY =
    "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjU3Y2IzMWI1Y2M0YTQ5YzJiMjFhNmVlNmI0YjBiNzYxIiwiaCI6Im11cm11cjY0In0=";


// ======================================
// DEPOTS
// ======================================

const DEPOTS = {

    LE11: {

        id: "LE11",

        name: "Leicester Depot",

        postcode: "LE11 5GX",

        lat: 52.785239,

        lng: -1.20804
    },

    B66: {

        id: "B66",

        name: "Birmingham Depot",

        postcode: "B66 1BT",

        lat: 52.4906,

        lng: -1.9705
    },

    LTN: {

        id: "LTN",

        name: "Luton Depot",

        postcode: "LU1 1AA",

        lat: 51.8787,

        lng: -0.4200
    }
};


// ======================================
// CURRENT DEPOT
// ======================================

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
// COLORS
// ======================================

const ROUTE_COLORS = {

    "Route 1": "#ef4444",

    "Route 2": "#3b82f6",

    "Route 3": "#22c55e",

    "Route 4": "#f59e0b",

    "Route 5": "#a855f7",

    "Route 6": "#92400e",

    "Unassigned": "gray",

    "Invalid": "black"
};


// ======================================
// ROUTE VISIBILITY
// ======================================

const routeVisibility = {

    "Route 1": true,
    "Route 2": true,
    "Route 3": true,
    "Route 4": true,
    "Route 5": true,
    "Route 6": true
};


// ======================================
// SESSION STORAGE
// ======================================

const SESSION_STORAGE_KEY =
    "joybuy_saved_sessions";


// ======================================
// DATA
// ======================================

let stopsData = [];

let markers = [];

let polylines = [];

let routeSummaries = {};

let movedStops = {};


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
                    `https://joybuy-backend.onrender.com/upload?depot=${currentDepot.id}`,
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
                !routeVisibility[
                    stop.route
                ]
            ) {
                return;
            }

            if (
                !stop.lat ||
                !stop.lng
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

        await drawRealRoute(
            route,
            stops,
            ROUTE_COLORS[
                route
            ] || "gray"
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

    if (
        !routeVisibility[
            routeName
        ]
    ) {
        return;
    }

    if (stops.length < 1) {
        return;
    }

    try {

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
// TOGGLE ROUTE
// ======================================

window.toggleRoute =
async function(route) {

    routeVisibility[route] =
        !routeVisibility[route];

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

            card.innerHTML = `

                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    margin-bottom:10px;
                ">

                    <div style="
                        font-size:18px;
                        font-weight:bold;
                    ">
                        ${route}
                    </div>

                    <input
                        type="checkbox"
                        ${routeVisibility[route] ? 'checked' : ''}
                        onchange="
                            toggleRoute('${route}')
                        "
                    >

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
            `;

            routeStats.appendChild(
                card
            );
        }
    );

    renderSavedSessions();
}


// ======================================
// EXPORT
// ======================================

function exportRoutes() {

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

                        Redelivery:
                            stop.redelivery
                                ? "YES"
                                : "NO",

                        Route:
                            stop.route
                    })
                );

            const worksheet =
                XLSX.utils
                .json_to_sheet(
                    exportData
                );

            XLSX.utils
                .book_append_sheet(
                    workbook,
                    worksheet,
                    route.substring(0, 31)
                );
        }
    );

    XLSX.writeFile(
        workbook,
        'Optimized_Routes.xlsx'
    );
}


// ======================================
// SAVE SESSION
// ======================================

function saveCurrentSession() {

    const existingSessions =
        JSON.parse(
            localStorage.getItem(
                SESSION_STORAGE_KEY
            ) || "[]"
        );

    const sessionData = {

        id:
            crypto.randomUUID(),

        createdAt:
            new Date().toLocaleString(),

        depot:
            currentDepot.id,

        stopsData:
            stopsData,

        movedStops:
            movedStops
    };

    existingSessions.unshift(
        sessionData
    );

    const limitedSessions =
        existingSessions.slice(0, 3);

    localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(
            limitedSessions
        )
    );

    renderSavedSessions();

    alert(
        "Session saved successfully."
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
                SESSION_STORAGE_KEY
            ) || "[]"
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
        session.stopsData || [];

    movedStops =
        session.movedStops || {};

    await renderMap();

    renderSidebar();
};


// ======================================
// DELETE SESSION
// ======================================

window.deleteSession =
function(sessionId) {

    const sessions =
        JSON.parse(
            localStorage.getItem(
                SESSION_STORAGE_KEY
            ) || "[]"
        );

    const filtered =
        sessions.filter(
            x => x.id !== sessionId
        );

    localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(filtered)
    );

    renderSavedSessions();
};


// ======================================
// RENDER SESSIONS
// ======================================

function renderSavedSessions() {

    const container =
        document.getElementById(
            "savedSessions"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const sessions =
        JSON.parse(
            localStorage.getItem(
                SESSION_STORAGE_KEY
            ) || "[]"
        );

    if (sessions.length === 0) {

        container.innerHTML = `
            <div style="
                color:#999;
                font-size:13px;
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
                    "div"
                );

            div.style.background =
                "#1f2937";

            div.style.color =
                "white";

            div.style.padding =
                "10px";

            div.style.marginBottom =
                "10px";

            div.style.borderRadius =
                "10px";

            div.innerHTML = `

                <div style="
                    font-weight:bold;
                    margin-bottom:6px;
                ">
                    ${DEPOTS[session.depot]?.name || session.depot}
                </div>

                <div style="
                    font-size:12px;
                    opacity:0.8;
                    margin-bottom:10px;
                ">
                    ${session.createdAt}
                </div>

                <div style="
                    display:flex;
                    gap:8px;
                ">

                    <button
                        onclick="loadSession('${session.id}')"
                        style="
                            flex:1;
                            padding:8px;
                            background:#2563eb;
                            color:white;
                            border:none;
                            border-radius:6px;
                            cursor:pointer;
                        "
                    >
                        Load
                    </button>

                    <button
                        onclick="deleteSession('${session.id}')"
                        style="
                            flex:1;
                            padding:8px;
                            background:#dc2626;
                            color:white;
                            border:none;
                            border-radius:6px;
                            cursor:pointer;
                        "
                    >
                        Delete
                    </button>

                </div>
            `;

            container.appendChild(
                div
            );
        }
    );
}


// ======================================
// INITIALIZE
// ======================================

renderSidebar();
renderSavedSessions();