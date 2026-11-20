import { Link } from 'react-router-dom';
import { ChapterLayout, Example, H, S, toc } from './layout';
import {
  TableA_1, TableA_2, TableD_1, TableD_2, TableE_1, TableE_2, TableE_3, TableG_1, TableG_2, TableG_3,
} from '../research/tables';
import { TableF_1 } from '../research/figures2';

export function Appendices() {
  return (
    <ChapterLayout
      eyebrow="Appendices"
      title="Appendices"
      pages="25–40"
      lead="Variable notes, definitions, software, annual ledgers, full category tables, model review tables, and the completeness and geographic audit."
      toc={toc([
        ['A', 'Selected Variable Notes'], ['B', 'Key Definitions and Metric Reading'], ['C', 'Software and Reproducibility'],
        ['D', 'Annual Record and Outcome-Coverage Ledger'], ['E', 'Full Common-Era Category Tables'], ['F', 'Detailed Model Review Tables'],
        ['G', 'Source-Field Completeness and Geographic Audit'],
      ])}
      prev={{ to: '/conclusion', label: 'Conclusion & Future Scope' }}
      next={{ to: '/report', label: 'Read the full report' }}
    >
      <S number="A" title="Selected Variable Notes">
        <p>
          The following notes summarise variables that recur in the report. Source names are preserved where useful; derived labels are created
          for this analysis.
        </p>
        <TableA_1 />
        <H>Injury-count reconciliation</H>
        <p>
          For records with all injury components available, the total injury count was compared with the sum of fatal, major, moderate and
          minor injuries. The table shows the number of records that did not reconcile in each eligible year. The component comparison is
          unavailable after 2018; those years should not be read as having zero discrepancies.
        </p>
        <TableA_2 />
      </S>

      <S number="B" title="Key Definitions and Metric Reading">
        <H>Conditional serious/fatal share</H>
        <p>For category <em>g</em>, the reported share is</p>
        <div className="my-3 flex items-center justify-center gap-2 font-serif text-lg" role="math"
          aria-label="p hat sub g equals known-severity crashes in g classified serious or fatal, divided by all known-severity crashes in g">
          <span>p̂<sub>g</sub> =</span>
          <span className="inline-flex flex-col items-center text-base">
            <span className="border-b border-ink px-2 pb-0.5">known-severity crashes in g classified serious/fatal</span>
            <span className="px-2 pt-0.5">all known-severity crashes in g</span>
          </span>
        </div>
        <p>
          The numerator and denominator both refer to reported crash records. The quantity is not a crash rate per trip, person, vehicle-mile or
          road segment.
        </p>
        <H>Odds ratio</H>
        <p>
          In the logistic model, an odds ratio compares conditional odds between a category and its stated reference after accounting for the
          included model terms. It is not a risk ratio, a percentage-point difference or a causal effect. Confidence intervals quantify
          model-based uncertainty under the specified fit; they do not cover every source of measurement or selection bias.
        </p>
        <H>Average precision and ROC–AUC</H>
        <p>
          Average precision summarises the precision–recall trade-off and is informative when the positive class is rare; a simple
          prevalence-level score is the reference point for a non-informative ranking. ROC–AUC measures how often a randomly selected positive is
          ranked above a randomly selected negative across thresholds. Neither measure establishes probability calibration or operational value.
        </p>
        <H>Balanced accuracy and Brier score</H>
        <p>
          Balanced accuracy averages sensitivity and specificity at a stated classification threshold. The 0.50 threshold used in the comparison
          is illustrative and is not a validated policy threshold for class-weighted models. The Brier score is the mean squared difference
          between probabilities and outcomes; lower is better on the same data, but an uncalibrated score should not be presented as an accurate
          individual risk estimate.
        </p>
      </S>

      <S number="C" title="Software and Reproducibility">
        <p>
          The analysis was run in Python 3.13.18 using NumPy 2.4.6, pandas 2.2.3, Matplotlib 3.10.0, Seaborn 0.13.2, SciPy 1.16.3, statsmodels
          0.15.0, scikit-learn 1.6.1, Shapely 2.2.0 and GeoPandas 1.2.0.
        </p>
        <p>
          The reported row counts, category denominators, time windows and model splits are recorded alongside the results. A rerun should
          preserve the same outcome definitions and year boundaries, verify code labels against the appropriate source documentation, and keep
          the later test period separate from model development.
        </p>
        <p className="text-sm">
          The original notebook is listed under <Link className="link" to="/resources">Resources</Link>.
        </p>
      </S>

      <S number="D" title="Annual Record and Outcome-Coverage Ledger">
        <p>
          This table reports the key year-level counts used in the analysis. “Known outcome” means a severity code in the 0–4 group used by this
          project’s binary target. Fatal share is fatal records as a percentage of known-severity records. The serious/fatal share is shown only
          from 2016 onward because the severity definition changes at that boundary. All counts are reported records; none is divided by
          traffic exposure.
        </p>
        <TableD_1 />
        <H>Valid hour coverage by year</H>
        <p>
          The time-of-day comparison uses records with a valid hour from 0 to 23. Coverage was above 96% in each year from 2004 through 2023, but
          only 387 of 10,228 records in 2024 had a valid hour. This abrupt change is why 2024 is not treated as a comparable year in the
          time-of-day analysis.
        </p>
        <TableD_2 />
        <p>
          The table is intentionally more detailed than the report’s trend discussion so that a reader can inspect denominators. In particular,
          the known-severity percentage changes over time. A trend in the outcome share is therefore partly a trend in which records have an
          analysable outcome. A future rerun should retain both the count and coverage columns rather than plotting percentages alone.
        </p>
        <Example>
          <p>
            If a county’s annual crash chart dips, a decision-maker should check whether the number of reports fell, whether severity was recorded
            for the same share of reports, and whether traffic volume changed. Looking at all three prevents a lower count from being
            automatically presented as a lower underlying risk.
          </p>
        </Example>
      </S>

      <S number="E" title="Full Common-Era Category Tables">
        <p>
          The tables below make the category-specific denominators visible for comparisons summarised in Chapter 3. The counts and percentages
          below cover the 2016–2023 common era. A small category can have an unstable percentage; a high percentage remains conditional on being a
          reported crash with known severity.
        </p>
        <H>Collision type</H>
        <TableE_1 />
        <H>Illumination and time period</H>
        <TableE_2 />
        <H>Intersection context</H>
        <TableE_3 />
        <p>
          These category tables are descriptive, and the intersection categories were pooled for the formal chi-square test where counts were
          sparse. The values for one-record or very small categories should not be used to rank an actual design feature. The apparent precision
          of a percentage to three decimal places is for reproducibility; it does not mean the underlying estimate is that precise in a
          decision-making sense.
        </p>
      </S>

      <S number="F" title="Detailed Model Review Tables">
        <H>Precision at selected review fractions</H>
        <p>
          The classifier output can be read as a hypothetical review queue: choose the highest-scored portion of records for further human
          review, then count how many serious/fatal outcomes appear in that portion. This is a retrospective evaluation, not a recommended
          operational cutoff.
        </p>
        <TableF_1 />
        <H>What these thresholds do and do not mean</H>
        <p>
          The test period has 27,697 records and 1,231 serious/fatal outcomes, approximately 4.44%. At the 5% queue size, the HistGradientBoosting
          model finds 310 serious/fatal records, but 1,075 of the flagged cases are not in the serious/fatal class. At the 20% queue size, it finds
          571 such records and misses the other 660. A wider queue catches more of the class while adding many more records for review. Whether
          that trade-off is useful depends on the real review capacity, cost of false positives and false negatives, fairness requirements and
          the purpose of the queue. None of those operational costs was specified in this project.
        </p>
        <p>
          The 0.50 threshold in the balanced-accuracy table is an illustrative evaluation choice, not an action rule. A future analysis would need
          a temporally separated calibration set, an explicitly defined decision objective and a genuinely untouched evaluation set. It should
          also assess subgroup performance and missingness before any external use.
        </p>
        <Example>
          <p>
            If a district can investigate only a small set of reports, a ranking model could be tested as a way to organise retrospective review.
            Before use, the district would decide what the review is for, how many cases it can handle and the consequences of missing a serious
            case. The model score alone cannot make those policy choices.
          </p>
        </Example>
      </S>

      <S number="G" title="Source-Field Completeness and Geographic Audit">
        <p>
          This appendix brings together selected completeness figures that affect the feasibility of follow-up analyses. “Available” means a
          non-missing value in the dataset; it does not certify correctness or a consistent measurement process.
        </p>
        <TableG_1 />
        <p>
          Several of the least-complete fields concern work zones or specialised road attributes. Their blanks are not zeros, and analyses that
          require them would use only a small portion of the dataset.
        </p>
        <TableG_2 />
        <p>
          Of 238,556 candidate state-route decimal coordinate records, 238,281 were inside the county polygon and 275 were outside. The spatial
          denominator also included 196,745 located records with known severity and 41,536 located records with unknown severity. A map of all
          located crashes and a severity share among located crashes therefore describe different groups.
        </p>
        <H>Coordinate-field coverage by year</H>
        <p>
          The number of records with selected state-route coordinates varies across the study period. The first three years have the largest
          numbers of records without a selected coordinate pair. The counts below describe coordinate availability, not a verified match to a
          road segment.
        </p>
        <TableG_3 />
        <p>
          The alternative police-coordinate format was only a diagnostic hypothesis. Among candidate pairs, the median discrepancy was 4.16
          metres and the 99th percentile was 398.91 metres; 2,146 of 238,517 pairs exceeded 500 metres. That decoding was not accepted as an
          official coordinate source. The large upper-tail discrepancies mean the two coordinate formats should not be treated as
          interchangeable.
        </p>
      </S>

    </ChapterLayout>
  );
}
