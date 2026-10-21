import type { GraphDiagram, Group, Node } from '@kiyora/dsl';
import type { Bounds } from '../paint/figures';

/** The four directions a layered graph can flow in. */
export const LAYOUT_DIRECTIONS = ['right', 'down', 'left', 'up'] as const;

/** A direction a layered graph flows in. */
export type LayoutDirection = (typeof LAYOUT_DIRECTIONS)[number];

/** The direction a graph flows in when its Source names none. */
export const DEFAULT_LAYOUT_DIRECTION: LayoutDirection = 'down';

/** The gap a laid-out node keeps from the frame's leading edges, in board units. */
export const LAYOUT_INSET = 24;

/** The box one laid-out node takes: a figure of the default size. */
export const LAYOUT_NODE = { h: 100, w: 160 } as const;

/** The gap between two nodes on one rank, in board units. */
export const LAYOUT_GAP = 40;

/** The gap between two ranks, in board units. */
export const LAYOUT_RANK_GAP = 80;

/** One node's box, and the rank the graph put it on. */
export type NodePlacement = Bounds & { id: string; rank: number };

/** A group's derived box: everything its member nodes occupy. */
export type GroupPlacement = Bounds & { id: string };

/** What the layout produces: every node placed, and every non-empty group boxed. */
export type Layout = {
  groups: GroupPlacement[];
  nodes: NodePlacement[];
};

/** What a layout call may override: the diagram's direction and the frame's inset. */
export type LayoutOptions = {
  direction?: LayoutDirection;
  inset?: number;
};

/** A directed link between two node indices, after group ends were expanded. */
type Link = {
  from: number;
  to: number;
};

/** The groups that hold `node`, innermost first, cut when a parent cycle repeats. */
const groupChainOf = (node: Node, groups: Map<string, Group>): string[] => {
  const chain: string[] = [];
  const seen = new Set<string>();
  let id = node.group;

  while (id !== undefined && !seen.has(id)) {
    seen.add(id);
    chain.push(id);
    id = groups.get(id)?.parent;
  }

  return chain;
};

/** The node indices each group holds, directly or through a nested group. */
const membersOf = (
  chains: readonly string[][],
  groups: readonly Group[]
): Map<string, number[]> => {
  const members = new Map<string, number[]>();

  for (const group of groups) {
    if (!members.has(group.id)) {
      members.set(group.id, []);
    }
  }

  for (const [index, chain] of chains.entries()) {
    for (const group of chain) {
      members.get(group)?.push(index);
    }
  }

  return members;
};

/** The links a diagram draws, with a group end expanded to each node it holds. */
const linksOf = (
  diagram: GraphDiagram,
  members: Map<string, number[]>,
  nodeIndex: Map<string, number>
): Link[] => {
  const links: Link[] = [];

  const endsOf = (id: string): number[] => {
    const index = nodeIndex.get(id);
    if (index !== undefined) {
      return [index];
    }

    return [...(members.get(id) ?? [])];
  };

  for (const edge of diagram.edges) {
    for (const from of endsOf(edge.from)) {
      for (const to of endsOf(edge.to)) {
        if (from !== to) {
          links.push({ from, to });
        }
      }
    }
  }

  return links;
};

/** Each node's strongly connected component, numbered in discovery order. */
const componentsOf = (count: number, links: readonly Link[]): number[] => {
  const adjacency: number[][] = Array.from({ length: count }, () => []);
  for (const link of links) {
    adjacency[link.from]?.push(link.to);
  }

  const index = new Array<number>(count).fill(-1);
  const low = new Array<number>(count).fill(0);
  const component = new Array<number>(count).fill(-1);
  const onStack = new Array<boolean>(count).fill(false);
  const stack: number[] = [];
  let next = 0;
  let found = 0;

  const visit = (node: number): void => {
    index[node] = next;
    low[node] = next;
    next += 1;
    stack.push(node);
    onStack[node] = true;

    for (const target of adjacency[node] ?? []) {
      if (index[target] === -1) {
        visit(target);
        low[node] = Math.min(low[node] ?? 0, low[target] ?? 0);
      } else if (onStack[target]) {
        low[node] = Math.min(low[node] ?? 0, index[target] ?? 0);
      }
    }

    if (low[node] !== index[node]) {
      return;
    }

    let member = stack.pop();
    while (member !== undefined) {
      onStack[member] = false;
      component[member] = found;
      if (member === node) {
        break;
      }
      member = stack.pop();
    }
    found += 1;
  };

  for (let node = 0; node < count; node += 1) {
    if (index[node] === -1) {
      visit(node);
    }
  }

  return component;
};

/**
 * The rank of every node: its longest path from a root, measured on the graph
 * with each cycle collapsed to one node. A cycle therefore takes one rank
 * instead of hanging the walk or stacking its members on top of each other.
 */
const ranksOf = (
  count: number,
  links: readonly Link[],
  component: readonly number[]
): number[] => {
  if (count === 0) {
    return [];
  }

  const components = Math.max(...component) + 1;
  const adjacency: number[][] = Array.from({ length: components }, () => []);
  const remaining = new Array<number>(components).fill(0);

  for (const link of links) {
    const from = component[link.from];
    const to = component[link.to];
    if (from === undefined || to === undefined || from === to) {
      continue;
    }

    adjacency[from]?.push(to);
    remaining[to] = (remaining[to] ?? 0) + 1;
  }

  const queue: number[] = [];
  for (let one = 0; one < components; one += 1) {
    if (remaining[one] === 0) {
      queue.push(one);
    }
  }

  const ranks = new Array<number>(components).fill(0);
  let head = 0;
  while (head < queue.length) {
    const current = queue[head] ?? 0;
    head += 1;

    for (const target of adjacency[current] ?? []) {
      ranks[target] = Math.max(ranks[target] ?? 0, (ranks[current] ?? 0) + 1);
      remaining[target] = (remaining[target] ?? 1) - 1;
      if (remaining[target] === 0) {
        queue.push(target);
      }
    }
  }

  return component.map((one) => ranks[one] ?? 0);
};

/** The nodes of each rank, in source order. */
const ranksByNode = (ranks: readonly number[]): number[][] => {
  const byRank: number[][] = [];

  for (const [index, rank] of ranks.entries()) {
    if (byRank[rank] === undefined) {
      byRank[rank] = [];
    }
    byRank[rank]?.push(index);
  }

  return byRank;
};

/** The box that holds every one of `boxes`, or `null` when there are none. */
const unionOf = (boxes: readonly Bounds[]): Bounds | null => {
  if (boxes.length === 0) {
    return null;
  }

  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.w));
  const bottom = Math.max(...boxes.map((box) => box.y + box.h));

  return { h: bottom - y, w: right - x, x, y };
};

/**
 * Lays a graph out in layers: it ranks every node by its distance along the
 * diagram's direction, then places each rank across that direction, keeping the
 * frame's leading inset. A cycle is one rank, a disconnected node joins the
 * first rank, and an edge that names a group is an edge from every member.
 *
 * Pure and deterministic: the same diagram and frame produce the same boxes,
 * with nodes in source order and no measurement, clock or randomness.
 */
export const layoutGraph = (
  diagram: GraphDiagram,
  frame: Bounds,
  options: LayoutOptions = {}
): Layout => {
  const { nodes } = diagram;
  if (nodes.length === 0) {
    return { groups: [], nodes: [] };
  }

  const direction =
    options.direction ?? diagram.direction ?? DEFAULT_LAYOUT_DIRECTION;
  const inset = options.inset ?? LAYOUT_INSET;
  const groupsById = new Map(diagram.groups.map((group) => [group.id, group]));
  const chains = nodes.map((node) => groupChainOf(node, groupsById));
  const members = membersOf(chains, diagram.groups);
  const nodeIndex = new Map<string, number>();
  for (const [index, node] of nodes.entries()) {
    if (!nodeIndex.has(node.id)) {
      nodeIndex.set(node.id, index);
    }
  }

  const links = linksOf(diagram, members, nodeIndex);
  const ranks = ranksOf(nodes.length, links, componentsOf(nodes.length, links));
  const byRank = ranksByNode(ranks);
  const horizontal = direction === 'right' || direction === 'left';
  const main = horizontal ? LAYOUT_NODE.w : LAYOUT_NODE.h;
  const cross = horizontal ? LAYOUT_NODE.h : LAYOUT_NODE.w;

  const crossOfRank = (rank: readonly number[]): number =>
    rank.length * cross + (rank.length - 1) * LAYOUT_GAP;
  const widestRank = Math.max(...byRank.map((rank) => crossOfRank(rank)));
  const content = byRank.length * main + (byRank.length - 1) * LAYOUT_RANK_GAP;
  const crossOrigin = horizontal ? frame.y + inset : frame.x + inset;
  const leading = horizontal
    ? direction === 'right'
      ? frame.x + inset
      : frame.x + frame.w - inset - content
    : direction === 'down'
      ? frame.y + inset
      : frame.y + frame.h - inset - content;
  const trailing = horizontal
    ? frame.x + frame.w - inset
    : frame.y + frame.h - inset;

  const placements = new Array<NodePlacement | undefined>(nodes.length);
  for (const [rank, rankNodes] of byRank.entries()) {
    const rankMain =
      direction === 'left' || direction === 'up'
        ? trailing - main - rank * (main + LAYOUT_RANK_GAP)
        : leading + rank * (main + LAYOUT_RANK_GAP);
    const rankCross = crossOrigin + (widestRank - crossOfRank(rankNodes)) / 2;

    for (const [position, index] of rankNodes.entries()) {
      const item = nodes[index];
      if (item === undefined) {
        continue;
      }

      const offset = rankCross + position * (cross + LAYOUT_GAP);
      placements[index] = {
        h: LAYOUT_NODE.h,
        id: item.id,
        rank,
        w: LAYOUT_NODE.w,
        x: horizontal ? rankMain : offset,
        y: horizontal ? offset : rankMain,
      };
    }
  }

  const placed = placements.filter(
    (placement): placement is NodePlacement => placement !== undefined
  );

  const groupPlacements: GroupPlacement[] = [];
  for (const group of diagram.groups) {
    const box = unionOf(
      (members.get(group.id) ?? []).flatMap((index) => {
        const placement = placements[index];
        return placement === undefined ? [] : [placement];
      })
    );

    if (box !== null) {
      groupPlacements.push({ ...box, id: group.id });
    }
  }

  return { groups: groupPlacements, nodes: placed };
};
