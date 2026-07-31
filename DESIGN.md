# DESIGN.md

## Theme

Soft daylight planner — airy surfaces, sky-blue primary actions, mint highlight for marked days.

## Color

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-bg` | `#EEF2F7` | Page wash |
| `--color-surface` | `#FFFFFF` | Cards, nav |
| `--color-ink` | `#1B2430` | Primary text |
| `--color-muted` | `#8B95A5` | Secondary text |
| `--color-line` | `#E6EBF2` | Dividers |
| `--color-primary` | `#3B82F6` | FAB, selected chip, timeline |
| `--color-primary-soft` | `rgba(59,130,246,0.18)` | Day glow blue |
| `--color-mint` | `#34D399` | Alternate day glow / success card |
| `--color-mint-soft` | `rgba(52,211,153,0.22)` | Day glow green |
| `--color-danger` | `#EF4444` | Destructive |

Teacher palette tokens: `accent`→primary, `pro`→`#8B5CF6`, `success`→mint, `warning`→`#F59E0B`.

## Typography

System UI stack (`-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif`).  
Scale: caption 22rpx / body 28rpx / title 34rpx / display month 40rpx. Weight 400/600/700.

## Radius & elevation

- Card radius: 28rpx  
- Chip radius: 999rpx  
- FAB: 112rpx circle  
- Shadow: `0 12rpx 40rpx rgba(27,36,48,0.08)`  
- Soft selected glow: radial-ish via box-shadow color wash  

## Components

- **Month header**: chevron prev/next, centered `YYYY年M月`  
- **Filter chips**: horizontal scroll; active = solid primary  
- **Calendar grid**: 7 cols; marked days soft colored disc; selected stronger ring  
- **Booking card**: white soft card OR solid primary/mint for emphasis; title + time range  
- **Custom tab bar**: 日历 | FAB+ | 我的  
- **FAB**: primary blue, opens booking-edit  

## Layout

Calendar page stack: header → chips → grid →「当日约课」list → bottom safe padding for tab bar.
