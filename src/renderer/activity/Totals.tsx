import type { AppTotal } from '../../shared/api.ts'
import { useT } from '../i18n.ts'
import { hueVar } from './hues.ts'
import { appName } from './summary.ts'

export function Totals({ totals }: { totals: AppTotal[] }) {
  const { t, duration } = useT()
  const max = totals[0]?.seconds ?? 1

  return (
    <aside className="act-totals" data-totals="">
      <h3 className="act-h4">{t('activity.appsAndSites')}</h3>
      {totals.length === 0 ? (
        <p className="act-muted" data-no-records="">
          {t('activity.noRecords')}
        </p>
      ) : null}
      {totals.slice(0, 8).map(total => {
        const name = appName(total)
        return (
          <div className="act-app" key={name} data-app={name}>
            <i className="act-swatch" style={{ background: hueVar(name) }} />
            <span className="act-app-name">{name}</span>
            <span
              className="act-app-time tnum"
              data-seconds={Math.round(total.seconds)}
            >
              {duration(total.seconds)}
            </span>
            <span className="act-app-bar">
              <u
                style={{
                  width: `${(total.seconds / max) * 100}%`,
                  background: hueVar(name),
                }}
              />
            </span>
            {total.sites.slice(0, 3).map(site => (
              <span className="act-site" key={site.domain} data-site={site.domain}>
                <span>{site.domain}</span>
                <span className="tnum">{duration(site.seconds)}</span>
              </span>
            ))}
          </div>
        )
      })}
    </aside>
  )
}
