#!/usr/bin/env python3
"""Build the display geometry for the recorded experimental Ч:31 route."""

import argparse
import csv
import json
import math
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from urllib.parse import urlencode
from urllib.error import HTTPError
from urllib.request import Request, urlopen


OSRM_BASE_URL = "https://router.project-osrm.org"
ACCURACY_THRESHOLD_METERS = 30.0
MOVING_GAP_SECONDS = 60.0
MOVING_GAP_DISTANCE_METERS = 100.0
MATCH_CHUNK_SIZE = 10
MATCH_CHUNK_OVERLAP = 4
DISPLAY_ANCHOR_SPACING_METERS = 100.0
DESTINATION_ARRIVAL_RADIUS_METERS = 15.0
DESTINATION_ARRIVAL_MAX_SPEED_MPS = 1.0
DESTINATION_STOP_ID = 1030079578


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        type=Path,
        default=Path(
            "data/experimental/"
            "2026-09-18_100ail_to_OfficersPalace.csv"
        ),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/routes/routes-experimental.json"),
    )
    parser.add_argument(
        "--bus-stops",
        type=Path,
        default=Path("busstops-osm.json"),
    )
    return parser.parse_args()


def parse_timestamp(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def distance_meters(left, right):
    radius = 6_371_000
    left_latitude = math.radians(left[0])
    right_latitude = math.radians(right[0])
    latitude_delta = right_latitude - left_latitude
    longitude_delta = math.radians(right[1] - left[1])
    value = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(left_latitude)
        * math.cos(right_latitude)
        * math.sin(longitude_delta / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(value))


def request_json(path, query):
    request = Request(
        f"{OSRM_BASE_URL}{path}?{urlencode(query)}",
        headers={"User-Agent": "UB-Bus-Map-development/1.0"},
    )
    try:
        with urlopen(request, timeout=120) as response:
            result = json.load(response)
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"OSRM HTTP {error.code} for {request.full_url}: {detail}"
        ) from error
    if result.get("code") != "Ok":
        raise RuntimeError(result)
    return result


def append_coordinates(target, coordinates):
    for longitude, latitude in coordinates:
        coordinate = [round(latitude, 6), round(longitude, 6)]
        if not target or coordinate != target[-1]:
            target.append(coordinate)


def match_chunk(rows):
    coordinates = ";".join(
        f"{row['longitude']:.7f},{row['latitude']:.7f}"
        for row in rows
    )
    try:
        result = request_json(
            f"/match/v1/driving/{coordinates}",
            {
                "timestamps": ";".join(
                    str(int(row["timestamp"].timestamp()))
                    for row in rows
                ),
                "radiuses": ";".join(
                    str(max(5.0, row["accuracy"]))
                    for row in rows
                ),
                "gaps": "ignore",
                "tidy": "false",
                "overview": "full",
                "geometries": "geojson",
            },
        )
    except RuntimeError as error:
        if '"code":"NoMatch"' not in str(error):
            raise
        return {
            "geometry": [],
            "tracepoints": {},
            "unmatchedSourceIndices": [row["index"] for row in rows],
        }
    geometry = []
    for matching in result.get("matchings", []):
        append_coordinates(
            geometry,
            matching["geometry"]["coordinates"],
        )
    if len(geometry) < 2:
        return {
            "geometry": [],
            "tracepoints": {},
            "unmatchedSourceIndices": [row["index"] for row in rows],
        }
    tracepoints = result.get("tracepoints", [])
    return {
        "geometry": geometry,
        "tracepoints": {
            row["index"]: [
                round(tracepoint["location"][1], 6),
                round(tracepoint["location"][0], 6),
            ]
            for row, tracepoint in zip(rows, tracepoints)
            if tracepoint is not None
        },
        "unmatchedSourceIndices": [
            row["index"]
            for row, tracepoint in zip(rows, tracepoints)
            if tracepoint is None
        ],
    }


def route_bridge(start, destination):
    coordinates = (
        f"{start[1]:.6f},{start[0]:.6f};"
        f"{destination[1]:.6f},{destination[0]:.6f}"
    )
    result = request_json(
        f"/route/v1/driving/{coordinates}",
        {
            "overview": "full",
            "geometries": "geojson",
            "steps": "false",
        },
    )
    routes = result.get("routes", [])
    if not routes:
        raise RuntimeError("OSRM returned no road bridge")
    geometry = []
    append_coordinates(
        geometry,
        routes[0]["geometry"]["coordinates"],
    )
    return geometry


def chunk_rows(rows):
    chunks = []
    start = 0
    while start < len(rows) - 1:
        end = min(start + MATCH_CHUNK_SIZE, len(rows))
        chunks.append(rows[start:end])
        if end == len(rows):
            break
        start = end - MATCH_CHUNK_OVERLAP
    return chunks


def select_anchor_rows(rows):
    anchors = [rows[0]]
    last_coordinate = [rows[0]["latitude"], rows[0]["longitude"]]
    for row in rows[1:-1]:
        coordinate = [row["latitude"], row["longitude"]]
        if distance_meters(last_coordinate, coordinate) >= DISPLAY_ANCHOR_SPACING_METERS:
            anchors.append(row)
            last_coordinate = coordinate
    if rows[-1]["index"] != anchors[-1]["index"]:
        anchors.append(rows[-1])
    return anchors


def closest_coordinate_index(coordinates, target):
    return min(
        range(len(coordinates)),
        key=lambda index: distance_meters(coordinates[index], target),
    )


def stitch_matched_chunks(previous, current):
    """Join overlapping matches at the most consistent shared tracepoint."""
    shared_indices = sorted(
        set(previous["tracepoints"]) & set(current["tracepoints"])
    )
    if not shared_indices:
        return None

    join_source_index = min(
        shared_indices,
        key=lambda source_index: distance_meters(
            previous["tracepoints"][source_index],
            current["tracepoints"][source_index],
        ),
    )
    previous_join = previous["tracepoints"][join_source_index]
    current_join = current["tracepoints"][join_source_index]
    previous_geometry_index = closest_coordinate_index(
        previous["geometry"], previous_join
    )
    current_geometry_index = closest_coordinate_index(
        current["geometry"], current_join
    )

    stitched = previous["geometry"][: previous_geometry_index + 1]
    stitched.extend(current["geometry"][current_geometry_index + 1 :])
    return stitched


def main():
    args = parse_args()
    with args.input.open(encoding="utf-8-sig", newline="") as source:
        source_rows = list(csv.DictReader(source))

    rows = []
    for index, source_row in enumerate(source_rows):
        rows.append(
            {
                "index": index,
                "timestamp": parse_timestamp(source_row["timestamp_utc"]),
                "latitude": float(source_row["latitude"]),
                "longitude": float(source_row["longitude"]),
                "accuracy": float(source_row["horizontal_accuracy_m"]),
                "speed": (
                    float(source_row["speed_mps"])
                    if source_row["speed_mps"]
                    else math.inf
                ),
            }
        )

    bus_stop_data = json.loads(args.bus_stops.read_text(encoding="utf-8"))
    bus_stop_elements = bus_stop_data.get("elements", bus_stop_data)
    bus_stop_coordinates = {
        element["id"]: [element["lat"], element["lon"]]
        for element in bus_stop_elements
        if element.get("id") == DESTINATION_STOP_ID
    }
    destination_stop_coordinate = bus_stop_coordinates[DESTINATION_STOP_ID]

    raw_coordinates = [
        [row["latitude"], row["longitude"]]
        for row in rows
    ]
    excluded_rows = [
        row
        for row in rows
        if row["accuracy"] > ACCURACY_THRESHOLD_METERS
    ]
    filtered_rows = [
        row
        for row in rows
        if row["accuracy"] <= ACCURACY_THRESHOLD_METERS
    ]

    arrival_row = next(
        row
        for row in filtered_rows
        if distance_meters(
            [row["latitude"], row["longitude"]],
            destination_stop_coordinate,
        ) <= DESTINATION_ARRIVAL_RADIUS_METERS
        and row["speed"] <= DESTINATION_ARRIVAL_MAX_SPEED_MPS
    )
    display_rows = [
        row for row in filtered_rows if row["index"] <= arrival_row["index"]
    ]
    post_arrival_rows = [
        row for row in rows if row["index"] > arrival_row["index"]
    ]

    segments = [[]]
    moving_gaps = []
    for row in display_rows:
        if segments[-1]:
            previous = segments[-1][-1]
            gap_seconds = (
                row["timestamp"] - previous["timestamp"]
            ).total_seconds()
            gap_distance = distance_meters(
                [previous["latitude"], previous["longitude"]],
                [row["latitude"], row["longitude"]],
            )
            if (
                gap_seconds > MOVING_GAP_SECONDS
                and gap_distance > MOVING_GAP_DISTANCE_METERS
            ):
                moving_gaps.append(
                    {
                        "startIndex": previous["index"],
                        "endIndex": row["index"],
                        "startTimestamp": previous["timestamp"].isoformat(),
                        "endTimestamp": row["timestamp"].isoformat(),
                        "durationSeconds": round(gap_seconds, 3),
                        "straightLineDistanceMeters": round(
                            gap_distance, 1
                        ),
                    }
                )
                segments.append([])
        segments[-1].append(row)

    anchor_segments = [select_anchor_rows(segment) for segment in segments]
    segment_chunks = [chunk_rows(segment) for segment in anchor_segments]
    all_chunks = [
        chunk
        for chunks in segment_chunks
        for chunk in chunks
    ]
    with ThreadPoolExecutor(max_workers=3) as executor:
        matched_chunks = list(executor.map(match_chunk, all_chunks))

    chunk_index = 0
    unmatched_source_indices = set()
    matched_segments = []
    for chunks in segment_chunks:
        segment_match = None
        for _ in chunks:
            match = matched_chunks[chunk_index]
            chunk_index += 1
            unmatched_source_indices.update(
                match["unmatchedSourceIndices"]
            )
            if not match["geometry"]:
                continue
            if segment_match is None:
                segment_match = match
                continue
            stitched_geometry = stitch_matched_chunks(segment_match, match)
            if stitched_geometry is None:
                raise RuntimeError("Overlapping match chunks could not be joined")
            segment_match = {
                "geometry": stitched_geometry,
                "tracepoints": {
                    **segment_match["tracepoints"],
                    **match["tracepoints"],
                },
            }
        if segment_match is None:
            raise RuntimeError("An entire GPS segment could not be matched")
        matched_segments.append(segment_match["geometry"])

    display_coordinates = []

    gap_bridges = []
    for index, gap in enumerate(moving_gaps):
        gap_start = [
            rows[gap["startIndex"]]["latitude"],
            rows[gap["startIndex"]]["longitude"],
        ]
        gap_end = [
            rows[gap["endIndex"]]["latitude"],
            rows[gap["endIndex"]]["longitude"],
        ]
        gap_bridge = route_bridge(gap_start, gap_end)
        gap_bridges.append(
            {
                **gap,
                "bridgeCoordinateCount": len(gap_bridge),
                "method": "OSRM driving route on OSM roads",
            }
        )
        if index == 0:
            display_coordinates.extend(matched_segments[0])
        for coordinate in gap_bridge:
            if not display_coordinates or coordinate != display_coordinates[-1]:
                display_coordinates.append(coordinate)
        for coordinate in matched_segments[index + 1]:
            if not display_coordinates or coordinate != display_coordinates[-1]:
                display_coordinates.append(coordinate)

    if not moving_gaps:
        display_coordinates = matched_segments[0]

    display_anchor_count = sum(len(segment) for segment in anchor_segments)

    route = {
        "id": "experimental-ch31-20260918",
        "ref": "Ч:31",
        "from": "100 айл",
        "to": "Офицеруудын ордон",
        "source": "recorded_gps",
        "sourceFile": args.input.name,
        "recordedDate": "2026-09-18",
        "experimental": True,
        "geometrySource": "display_geometry_derived_from_recorded_gps",
        "stops": [
            2531768762,
            1268520201,
            3910449619,
            3911992658,
            4762016617,
            3911993006,
            1030079578,
        ],
        "rawCoordinates": raw_coordinates,
        "displayCoordinates": display_coordinates,
        "geometryProcessing": {
            "accuracyThresholdMeters": ACCURACY_THRESHOLD_METERS,
            "excludedPointCount": len(excluded_rows),
            "excludedByReason": {
                "horizontalAccuracyAbove30Meters": len(excluded_rows)
            },
            "excludedSourceIndices": [
                row["index"] for row in excluded_rows
            ],
            "filteredPointCount": len(filtered_rows),
            "displayInputEndSourceIndex": arrival_row["index"],
            "postArrivalPointCount": len(post_arrival_rows),
            "displayAnchorCount": display_anchor_count,
            "displayAnchorSpacingMeters": DISPLAY_ANCHOR_SPACING_METERS,
            "mapMatching": {
                "engine": "OSRM",
                "roadData": "OpenStreetMap",
                "profile": "driving",
                "matchedInChunksOf": MATCH_CHUNK_SIZE,
                "unmatchedPointCount": len(unmatched_source_indices),
                "unmatchedSourceIndices": sorted(
                    unmatched_source_indices
                ),
                "displayGeometryMethod": (
                    "OSRM map matching of recorded GPS anchors"
                ),
            },
            "longGpsGaps": gap_bridges,
            "smoothing": (
                "No coordinate averaging; road-constrained map matching "
                "removes GPS jitter from the display geometry"
            ),
        },
    }
    output = {"routes": [route]}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":"))
        + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "rawCoordinateCount": len(raw_coordinates),
                "filteredPointCount": len(filtered_rows),
                "excludedPointCount": len(excluded_rows),
                "displayCoordinateCount": len(display_coordinates),
                "unmatchedPointCount": len(unmatched_source_indices),
                "unmatchedSourceIndices": sorted(
                    unmatched_source_indices
                ),
                "displayAnchorCount": display_anchor_count,
                "longGpsGaps": gap_bridges,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
