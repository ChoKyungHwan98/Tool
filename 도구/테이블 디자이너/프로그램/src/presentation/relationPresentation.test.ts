import { describe, expect, it } from 'vitest'
import { gameCSampleProject } from '../domain/gameCSampleProject'
import {
  buildRelationDisplayDescriptor,
  clampRelationPopoverPoint,
  RELATION_ERROR,
  RELATION_NEUTRAL,
  relationVisualStyle,
} from './relationPresentation'

describe('relation presentation', () => {
  it('describes the complete FK to PK path without changing the relation', () => {
    const relation = gameCSampleProject.relations.find((candidate) => candidate.relationId === 'relation_game_c_item_type')!

    expect(buildRelationDisplayDescriptor(gameCSampleProject, relation)).toMatchObject({
      sourcePath: 'Item.ItemTypeId',
      sourceRole: 'FK',
      targetPath: 'ItemType.ItemTypeId',
      targetRole: 'PK',
      ariaLabel: 'Item.ItemTypeId (FK)에서 ItemType.ItemTypeId (PK)를 참조합니다',
    })
  })

  it('keeps direct relations strong and unrelated relations neutral', () => {
    expect(relationVisualStyle('normal', '#167786')).toEqual({
      stroke: '#167786',
      strokeWidth: 1.6,
      strokeOpacity: 0.72,
    })
    expect(relationVisualStyle('active', '#167786')).toEqual({
      stroke: '#167786',
      strokeWidth: 2.6,
      strokeOpacity: 1,
    })
    expect(relationVisualStyle('dimmed', '#167786')).toEqual({
      stroke: RELATION_NEUTRAL,
      strokeWidth: 1.2,
      strokeOpacity: 0.14,
    })
    expect(relationVisualStyle('selected', '#167786').strokeWidth).toBe(3.2)
    expect(relationVisualStyle('invalid', '#167786')).toMatchObject({
      stroke: RELATION_ERROR,
      strokeDasharray: '6 4',
    })
  })

  it('clamps the popover to the visible canvas in flow coordinates', () => {
    const clamped = clampRelationPopoverPoint(
      { x: 960, y: 720 },
      { x: -200, y: -120, zoom: 0.8 },
      { width: 640, height: 480 },
    )

    expect(clamped.x * 0.8 - 200).toBeLessThanOrEqual(640 - 12 - 190)
    expect(clamped.y * 0.8 - 120).toBeLessThanOrEqual(480 - 12 - 35)
  })
})
