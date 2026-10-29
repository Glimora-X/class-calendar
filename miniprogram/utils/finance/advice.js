/**
 * 决策建议（与 UE 阈值对齐）
 */

const {
  getHoldingDays,
  calcIRR,
  calcTWR,
  getRecent7Day,
  getCumProfit,
  getEffectivePrincipal,
  getStable
} = require('./metrics')

/**
 * @param {object} holding
 * @param {string} asOf
 * @returns {{ advice: string, score: number, reasons: string[] }}
 */
function calcAdvice(holding, asOf) {
  const d = getHoldingDays(holding, asOf)
  const irr = calcIRR(holding, asOf)
  const twr = calcTWR(holding)
  const r7 = getRecent7Day(holding)
  const cp = getCumProfit(holding)
  const ep = getEffectivePrincipal(holding)
  const pr = ep ? cp / ep : 0
  const reasons = []
  let advice = 'HOLD'
  let score = 50

  if (d < 7) {
    return {
      advice: 'WATCH',
      score: 30,
      reasons: ['持有不足7天，数据不足', '暂不展示年化类指标，也不生成强决策建议']
    }
  }

  if (irr !== null && irr < 0 && twr !== null && twr < 0) {
    advice = 'EXIT'
    score = 10
    reasons.push(
      'IRR=' + irr.toFixed(2) + '% 且 TWR=' + (twr * 100).toFixed(2) + '% 均为负'
    )
    reasons.push('止损信号明显，建议退出')
  } else if (irr !== null && irr > 2 && pr >= 0.07) {
    advice = 'REDUCE'
    score = 35
    reasons.push('IRR=' + irr.toFixed(2) + '% 表现较好')
    reasons.push(
      '累计收益占本金' + (pr * 100).toFixed(2) + '%，达到止盈区间(≥7%)'
    )
    reasons.push('建议减仓锁定部分利润')
  } else if (twr !== null && twr > 0 && r7 !== null && r7 <= -1.2) {
    advice = 'ADD'
    score = 75
    reasons.push('TWR=' + (twr * 100).toFixed(2) + '% 为正，整体趋势向好')
    reasons.push(
      '近7日收益回调' + r7.toFixed(2) + '%，存在加仓机会(≤-1.2%)'
    )
  } else if (r7 !== null && r7 >= 4) {
    advice = 'WATCH'
    score = 55
    reasons.push('近7日涨幅' + r7.toFixed(2) + '% 过快(≥4%)')
    reasons.push('追高风险较大，建议观望')
  }

  if (advice === 'HOLD') {
    if (irr !== null && irr < 0 && twr !== null && twr > 0) {
      reasons.push(
        'IRR=' +
          irr.toFixed(2) +
          '% 为负但 TWR=' +
          (twr * 100).toFixed(2) +
          '% 为正'
      )
      reasons.push('更像时点问题，建议继续持有观察')
      score = 45
    } else if (irr !== null && irr > 0) {
      reasons.push(
        'IRR=' +
          irr.toFixed(2) +
          '%，TWR=' +
          (twr !== null ? (twr * 100).toFixed(2) + '%' : 'N/A')
      )
      reasons.push('表现中性，建议持有')
      score = 60
    } else {
      reasons.push('各项指标中性，无明确信号')
      score = 50
    }
  }

  if (advice === 'HOLD' || advice === 'ADD') {
    const s = getStable(holding, asOf)
    if (
      s &&
      s.stableAnnualized !== null &&
      holding.expectedAnnual &&
      s.stableAnnualized > Number(holding.expectedAnnual)
    ) {
      score += 5
      reasons.push('稳仓后年化超过预期，达标')
    }
  }

  if (d >= 7 && d < 30) {
    reasons.push('稳仓周期较短(' + d + '天)，指标参考性有限')
  }

  return { advice, score, reasons }
}

module.exports = {
  calcAdvice
}
