#!/usr/bin/env python3
"""Validate Overpass route=bus data and generate the local route dataset."""

import argparse
import json
import math
from collections import Counter
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--bus-stops", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--report", type=Path)
    return parser.parse_args()


def merge_way_nodes(oriented_ways):
    node_ids = []
    for way_nodes in oriented_ways:
        if node_ids and node_ids[-1] == way_nodes[0]:
            node_ids.extend(way_nodes[1:])
        else:
            node_ids.extend(way_nodes)
    return node_ids


def orient_way_sequence(way_ids, ways):
    first_way = ways[way_ids[0]]["nodes"]
    states = [
        (0, [first_way], [False]),
        (0, [list(reversed(first_way))], [True]),
    ]

    for way_id in way_ids[1:]:
        way_nodes = ways[way_id]["nodes"]
        next_states = []

        for reversed_way in (False, True):
            current_way = (
                list(reversed(way_nodes))
                if reversed_way
                else way_nodes
            )
            candidates = []

            for gap_count, sequence, reverse_flags in states:
                candidates.append(
                    (
                        gap_count
                        + (sequence[-1][-1] != current_way[0]),
                        sequence + [current_way],
                        reverse_flags + [reversed_way],
                    )
                )

            next_states.append(
                min(candidates, key=lambda candidate: candidate[0])
            )

        states = next_states

    minimum_gaps = min(state[0] for state in states)
    return [state for state in states if state[0] == minimum_gaps]


def planar_distance(point_a, point_b):
    average_latitude = math.radians((point_a[0] + point_b[0]) / 2)
    delta_x = (
        (point_b[1] - point_a[1])
        * 111320
        * math.cos(average_latitude)
    )
    delta_y = (point_b[0] - point_a[0]) * 110540
    return math.hypot(delta_x, delta_y)


def platform_positions(route_node_ids, platform_ids, nodes):
    route_points = [
        (nodes[node_id]["lat"], nodes[node_id]["lon"])
        for node_id in route_node_ids
    ]
    cumulative_distances = [0.0]

    for point_a, point_b in zip(route_points, route_points[1:]):
        cumulative_distances.append(
            cumulative_distances[-1]
            + planar_distance(point_a, point_b)
        )

    positions = []

    for platform_id in platform_ids:
        platform = (
            nodes[platform_id]["lat"],
            nodes[platform_id]["lon"],
        )
        latitude_scale = math.cos(math.radians(platform[0]))
        closest = None

        for index, (point_a, point_b) in enumerate(
            zip(route_points, route_points[1:])
        ):
            start_x = (
                (point_a[1] - platform[1])
                * 111320
                * latitude_scale
            )
            start_y = (point_a[0] - platform[0]) * 110540
            end_x = (
                (point_b[1] - platform[1])
                * 111320
                * latitude_scale
            )
            end_y = (point_b[0] - platform[0]) * 110540
            delta_x = end_x - start_x
            delta_y = end_y - start_y
            length_squared = delta_x * delta_x + delta_y * delta_y
            position = (
                0
                if length_squared == 0
                else max(
                    0,
                    min(
                        1,
                        -(
                            start_x * delta_x + start_y * delta_y
                        )
                        / length_squared,
                    ),
                )
            )
            distance = math.hypot(
                start_x + position * delta_x,
                start_y + position * delta_y,
            )
            route_distance = (
                cumulative_distances[index]
                + position
                * (
                    cumulative_distances[index + 1]
                    - cumulative_distances[index]
                )
            )
            candidate = (distance, route_distance)

            if closest is None or candidate[0] < closest[0]:
                closest = candidate

        positions.append(closest)

    return positions


def platform_inversion_count(positions):
    return sum(
        positions[left][1] > positions[right][1] + 1
        for left in range(len(positions))
        for right in range(left + 1, len(positions))
    )


def connection_breaks(oriented_ways, way_ids, nodes):
    breaks = []

    for index in range(len(oriented_ways) - 1):
        previous_node_id = oriented_ways[index][-1]
        next_node_id = oriented_ways[index + 1][0]

        if previous_node_id == next_node_id:
            continue

        previous_node = (
            nodes[previous_node_id]["lat"],
            nodes[previous_node_id]["lon"],
        )
        next_node = (
            nodes[next_node_id]["lat"],
            nodes[next_node_id]["lon"],
        )
        breaks.append(
            {
                "afterWay": way_ids[index],
                "beforeWay": way_ids[index + 1],
                "distanceMeters": round(
                    planar_distance(previous_node, next_node), 1
                ),
            }
        )

    return breaks


def main():
    args = parse_args()
    overpass_data = json.loads(args.input.read_text(encoding="utf-8"))
    bus_stop_data = json.loads(
        args.bus_stops.read_text(encoding="utf-8")
    )

    elements = overpass_data["elements"]
    nodes = {
        element["id"]: element
        for element in elements
        if element["type"] == "node"
    }
    ways = {
        element["id"]: element
        for element in elements
        if element["type"] == "way"
    }
    relations = [
        element
        for element in elements
        if element["type"] == "relation"
    ]
    bus_stop_ids = {
        element["id"]
        for element in bus_stop_data["elements"]
        if element.get("type") == "node"
    }

    routes = []
    adopted = []
    excluded = []
    total_platforms = 0
    matched_platforms = 0

    for relation in sorted(relations, key=lambda item: item["id"]):
        tags = relation.get("tags", {})
        members = relation.get("members", [])
        platform_ids = [
            member["ref"]
            for member in members
            if member["type"] == "node"
            and member.get("role") == "platform"
        ]
        way_ids = [
            member["ref"]
            for member in members
            if member["type"] == "way"
            and member.get("role") != "platform"
        ]
        matched_count = sum(
            platform_id in bus_stop_ids
            for platform_id in platform_ids
        )
        total_platforms += len(platform_ids)
        matched_platforms += matched_count

        reasons = []
        if not tags.get("ref"):
            reasons.append("missing_ref")
        if len(platform_ids) < 2:
            reasons.append("fewer_than_2_platform_nodes")
        if matched_count < 2:
            reasons.append("fewer_than_2_platforms_in_busstops")
        if not way_ids:
            reasons.append("no_route_ways")

        missing_way_ids = [
            way_id
            for way_id in way_ids
            if way_id not in ways
            or len(ways[way_id].get("nodes", [])) < 2
            or any(
                node_id not in nodes
                for node_id in ways[way_id].get("nodes", [])
            )
        ]
        if missing_way_ids:
            reasons.append("missing_way_geometry")

        oriented_ways = None
        reverse_flags = []
        breaks = []
        route_node_ids = []
        maximum_platform_distance = None

        if way_ids and not missing_way_ids:
            orientation_candidates = orient_way_sequence(way_ids, ways)
            candidate_details = []

            for gap_count, sequence, candidate_reverse_flags in (
                orientation_candidates
            ):
                candidate_node_ids = merge_way_nodes(sequence)
                positions = (
                    platform_positions(
                        candidate_node_ids,
                        platform_ids,
                        nodes,
                    )
                    if platform_ids
                    and all(
                        platform_id in nodes
                        for platform_id in platform_ids
                    )
                    else []
                )
                inversions = (
                    platform_inversion_count(positions)
                    if positions
                    else 0
                )
                candidate_details.append(
                    (
                        gap_count,
                        inversions,
                        sequence,
                        candidate_reverse_flags,
                        candidate_node_ids,
                        positions,
                    )
                )

            (
                gap_count,
                inversion_count,
                oriented_ways,
                reverse_flags,
                route_node_ids,
                positions,
            ) = min(
                candidate_details,
                key=lambda candidate: (candidate[0], candidate[1]),
            )
            breaks = connection_breaks(
                oriented_ways, way_ids, nodes
            )

            if gap_count:
                reasons.append("disconnected_way_joins")
            if positions and inversion_count:
                reasons.append(
                    "platform_order_not_aligned_with_geometry"
                )
            if positions:
                maximum_platform_distance = round(
                    max(position[0] for position in positions), 1
                )

        if reasons:
            excluded.append(
                {
                    "relationId": relation["id"],
                    "ref": tags.get("ref"),
                    "from": tags.get("from"),
                    "to": tags.get("to"),
                    "platformCount": len(platform_ids),
                    "matchedPlatformCount": matched_count,
                    "wayCount": len(way_ids),
                    "wayIds": way_ids,
                    "reasons": reasons,
                    "connectionBreaks": breaks,
                }
            )
            continue

        coordinates = []
        for node_id in route_node_ids:
            coordinate = [
                round(nodes[node_id]["lat"], 6),
                round(nodes[node_id]["lon"], 6),
            ]
            if not coordinates or coordinate != coordinates[-1]:
                coordinates.append(coordinate)

        routes.append(
            {
                "relationId": relation["id"],
                "ref": tags["ref"],
                "from": tags.get("from", ""),
                "to": tags.get("to", ""),
                "stops": platform_ids,
                "coordinates": coordinates,
            }
        )
        adopted.append(
            {
                "relationId": relation["id"],
                "ref": tags["ref"],
                "from": tags.get("from", ""),
                "to": tags.get("to", ""),
                "platformCount": len(platform_ids),
                "matchedPlatformCount": matched_count,
                "wayCount": len(way_ids),
                "wayIds": way_ids,
                "reversedWayCount": sum(reverse_flags),
                "coordinateCount": len(coordinates),
                "maximumPlatformDistanceMeters": (
                    maximum_platform_distance
                ),
            }
        )

    output = {"routes": routes}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(
            output,
            ensure_ascii=False,
            separators=(",", ":"),
        )
        + "\n",
        encoding="utf-8",
    )

    reason_counts = Counter(
        reason
        for relation in excluded
        for reason in relation["reasons"]
    )
    report = {
        "osmTimestamp": overpass_data.get("osm3s", {}).get(
            "timestamp_osm_base"
        ),
        "relationCount": len(relations),
        "adoptedRelationCount": len(routes),
        "excludedRelationCount": len(excluded),
        "distinctRefCount": len({route["ref"] for route in routes}),
        "coordinateCount": sum(
            len(route["coordinates"]) for route in routes
        ),
        "platformCount": total_platforms,
        "matchedPlatformCount": matched_platforms,
        "platformMatchRate": (
            matched_platforms / total_platforms
            if total_platforms
            else None
        ),
        "outputBytes": args.output.stat().st_size,
        "reasonCounts": dict(sorted(reason_counts.items())),
        "adopted": adopted,
        "excluded": excluded,
    }

    if args.report:
        args.report.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
