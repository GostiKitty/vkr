import { EngineeringCallout, EngineeringSectionHeader } from "../../shared/ui";

import { MonteCarloRunControls } from "./MonteCarloRunControls";



export function UncertaintyPanel() {

  return (

    <div className="space-y-5">

      <div className="ui-panel p-5 sm:p-6">

        <EngineeringSectionHeader

          kicker="Шаг 5 · риски"

          title="Неопределённость входов (Monte Carlo)"

          subtitle="Число прогонов и режим оценки. Анализ показывает разброс показателей при вариации климата, ACH, тепловыделений и уставок в той же RC-модели — это не «абсолютный прогноз» и не норматив СП 50."

        />



        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.95fr)]">

          <div className="space-y-4">

            <p className="text-sm font-semibold text-[color:var(--text-base)]">Параметры прогона</p>

            <EngineeringCallout variant="assumption" title="Изменения применяются к следующему прогону">

              <p>

                Число прогонов и режим оценки меняют только следующий запуск вероятностного анализа. Уже сохранённые распределения, гистограммы и CDF не

                пересчитываются автоматически.

              </p>

            </EngineeringCallout>



            <MonteCarloRunControls />



            <EngineeringCallout variant="success" title="Что произойдёт после запуска">

              <p>После успешного Monte Carlo результаты появятся во вкладке «Риски» с распределениями, перцентилями и картой рисков по помещениям.</p>

            </EngineeringCallout>



            <EngineeringCallout variant="info" title="Пока не вынесено в настройки">

              <p>

                Порог по пиковой нагрузке <code>heatingThresholdKW</code> и уровень риска <code>varLevel</code> уже есть в Monte Carlo-ядре, но пока не вынесены в

                редактируемый UI. Они помечены как TODO в backlog, чтобы не создавать новый расчётный контур без отдельного согласования.

              </p>

            </EngineeringCallout>

          </div>



          <div className="space-y-3">

            <p className="text-sm font-semibold text-[color:var(--text-base)]">Что означают числа</p>

            <EngineeringCallout variant="info" title="Гистограмма, CDF, P5 / P50 / P95">

              <p>

                <strong>Гистограмма</strong> показывает частоту значений метрики по прогонам, <strong>CDF</strong> — накопленную долю до заданного уровня.{" "}

                <strong>P5, P50, P95</strong> — типичный низкий, медианный и высокий уровень выборки.{" "}

                <strong>Вероятность превышения</strong> — доля сценариев выше выбранного порога; зависит от порога и числа прогонов.

              </p>

            </EngineeringCallout>

            <EngineeringCallout variant="assumption" title="VaR, CVaR и seed">

              <ul>

                <li>

                  <strong>VaR</strong> (value-at-risk) — порог на заданной вероятности: «не хуже этого значения» в соответствующей доле случаев.

                </li>

                <li>

                  <strong>CVaR</strong> — среднее в «хвосте» хуже VaR: насколько тяжёлые сценарии среди худших процентов.

                </li>

                <li>

                  <strong>Seed</strong> задаётся при запуске сценария Monte Carlo в конструкторе/отчёте: при тех же входах и seed последовательность случайных чисел воспроизводима; смена seed даёт другую выборку при тех же границах неопределённости.

                </li>

              </ul>

            </EngineeringCallout>

            <EngineeringCallout variant="attention" title="Инженерный вывод по риску">

              <p>

                Интерпретируйте разброс как чувствительность <em>данной</em> модели к допущениям по климату, ACH и режиму. Для проектной

                документации требуется отдельная нормативная база (СП и др.).

              </p>

            </EngineeringCallout>

          </div>

        </div>

      </div>

    </div>

  );

}



export default UncertaintyPanel;

