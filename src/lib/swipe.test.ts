import { describe, expect, it } from 'vitest'
import { SWIPE_MIN_DISTANCE_PX, swipeDirection } from './swipe'

describe('swipeDirection（Issue #50: カレンダーのフリック）', () => {
  it('左フリックは翌月（next）', () => {
    expect(swipeDirection(200, 100, 100, 100)).toBe('next')
  })

  it('右フリックは前月（prev）', () => {
    expect(swipeDirection(100, 100, 200, 100)).toBe('prev')
  })

  it('移動量がしきい値未満ならタップ扱いで null', () => {
    expect(swipeDirection(100, 100, 100 - SWIPE_MIN_DISTANCE_PX + 1, 100)).toBeNull()
    expect(swipeDirection(100, 100, 100 + SWIPE_MIN_DISTANCE_PX - 1, 100)).toBeNull()
    // まったく動いていない（通常のタップ）
    expect(swipeDirection(100, 100, 100, 100)).toBeNull()
  })

  it('しきい値ちょうどならフリックとして判定する', () => {
    expect(swipeDirection(100, 100, 100 - SWIPE_MIN_DISTANCE_PX, 100)).toBe('next')
    expect(swipeDirection(100, 100, 100 + SWIPE_MIN_DISTANCE_PX, 100)).toBe('prev')
  })

  it('縦方向が大きい動きはスクロール意図として null', () => {
    // 横60px・縦100px: 縦が横の2/3を超えるのでフリックにしない
    expect(swipeDirection(100, 100, 40, 200)).toBeNull()
    expect(swipeDirection(100, 300, 160, 200)).toBeNull()
  })

  it('少し斜めでも横が十分大きければフリックとして判定する', () => {
    // 横120px・縦40px: 横が縦の1.5倍以上ある
    expect(swipeDirection(200, 100, 80, 140)).toBe('next')
    expect(swipeDirection(80, 140, 200, 100)).toBe('prev')
  })
})
