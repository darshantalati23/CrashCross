import { Link } from 'react-router-dom';
import { Callout, Disclosure } from '../components/ui';
import { ChapterLayout, Example, S, toc } from './layout';
import {
  CalibrationFigure, ConfusionTables, CurvesFigure, Figure5_1, Figure5_2, LocationAuditTables, PermutationFigure,
  ReferenceImageFigure, RoundedGridMap, Table5_1, UncertaintyFigure,
} from '../research/figures2';
import { Table6_1 } from '../research/tables';

const MAP_REASON =
  'The exported hexbin polygons behind this figure are classified internal_review_only in the export’s access policy, so they are not ' +
  'published on this website and the map is not reconstructed here. The page image from the report is shown instead. The interactive ' +
  'supplementary grid map below uses separate, publishable rounded-grid summaries.';

export function Chapter4() {
  return (
    <ChapterLayout
      eyebrow="Chapter 4"
      title="Feature Engineering"
      pages="15–17"
      lead="Derived variables and leakage safeguards, feature selection, the location-source audit, spatial concentration, and what is missing for a true site-risk model."
      toc={toc([['4.1', 'Derived variables and leakage safeguards'], ['4.2', 'Feature selection'], ['4.3', 'Location-source audit'], ['4.4', 'Spatial concentration'], ['4.5', 'What is missing for a true site-risk model']])}
      prev={{ to: '/visualization', label: 'Visualization' }}
      next={{ to: '/model-fitting', label: 'Chapter 5: Model Fitting' }}
    >
      <S number="4.1" title="Derived variables and leakage safeguards">
        <p>
          We created analysis-ready group labels, a validated speed-limit field, valid hour and time-period categories, and a binary
          known-severity outcome. Invalid or sentinel time values are treated as missing instead of being interpreted as clock times. The
          severity outcome is generated only from known source codes: codes 1 and 2 map to the serious/fatal class, while 0, 3 and 4 map to the
          other-known class.
        </p>
        <p>
          Outcome-derived quantities—including fatal count, injury count and major-injury count—are excluded from classifier predictors. This
          avoids a model learning the answer from information that is part of, or recorded after, the outcome. Collision type is retained in one
          model comparison, but it is clearly described as post-crash information. It can improve ranking of already reported crashes; it is not
          available as a signal for predicting an imminent crash.
        </p>
        <Example>
          <p>
            Severity is the answer a severity model is meant to learn. Feeding the severity code back as a predictor would be like asking a
            student to solve an exam while showing them the answer key. The target is derived from the source severity field, which is excluded
            from the predictors along with injury counts.
          </p>
        </Example>
      </S>
      <S number="4.2" title="Feature selection">
        <p>
          The main model predictors are a restricted set of recorded contextual fields: month, weekday, speed limit, relation to road,
          intersection type and, in the extended feature set, collision type. Weather and road-surface groups were omitted because historical
          codebook mappings remain unverified. Urban/rural was also excluded because its source categories were not validated. Hour and
          illumination are omitted from the full-period classifier comparison because 2024 has structural gaps in those fields.
        </p>
        <p>
          Feature selection therefore reflects both statistical practicality and source credibility. A variable is not automatically useful
          because it exists in a wide dataset. Its meaning, coverage, timing and possible leakage all matter.
        </p>
        <Example>
          <p>
            If a system is intended to warn a driver before a crash, it cannot use the eventual collision type as an input. Collision type is
            useful for describing severity after the event, but it is learned from the event itself. A forecasting team would instead inventory
            what is genuinely known beforehand—such as road geometry or current conditions—and test those inputs separately.
          </p>
        </Example>
      </S>
      <S number="4.3" title="Location-source audit">
        <p>
          Two coordinate families occur in the source. State-route decimal coordinates are available for 238,556 records, or about 95.9%. The
          police GPS fields contain text resembling degrees, minutes and seconds. A diagnostic parser compared 238,517 candidate pairs: the
          median difference was 4.16 metres, the 95th percentile 36.91 metres and 2,146 pairs (0.90%) differed by over 500 metres. Despite the
          encouraging median agreement, the police format was not officially verified; it was therefore not used as an operational location
          source.
        </p>
        <Disclosure summary="Exported candidate-coordinate comparison">
          <LocationAuditTables />
        </Disclosure>
        <p className="mt-4">
          The selected state-route coordinate set includes 238,556 candidate records, of which 238,281 fall inside the Allegheny County polygon
          used in the analysis; 275 lie outside. The polygon check uses the county boundary rather than a rectangular coordinate filter. This is
          important for a county map, but it does not establish perfect site attribution or roadway matching.
        </p>
        <Example>
          <p>
            A point may look as though it falls in the right neighbourhood when plotted, but a coordinate-format mistake can shift it several
            streets or beyond the county line. Before using a map to dispatch an engineer, an analyst should check the coordinate definition,
            compare it to a second source and resolve large disagreements. Candidate agreement is informative, but the unverified police format is
            not promoted to the official location source.
          </p>
        </Example>
      </S>
      <S number="4.4" title="Spatial concentration">
        <p>
          The map shows where located crash reports accumulate across the county. Central locations have dense concentrations, while the
          pattern thins toward the edges. This is consistent with an urban county having denser activity in and around its central built-up
          area, but the map alone cannot tell us whether a road segment has excessive risk. Higher counts could reflect higher traffic volumes,
          more intersections, a larger number of road users, denser reporting or a combination of these.
        </p>
        <ReferenceImageFigure
          label="Figure 4.1"
          caption="County-screened map of located reported crashes. Each point contributes to historical concentration; the map is not normalised for traffic or roadway exposure."
          page={26}
          itemId="report_figure_4_1"
          reason={MAP_REASON}
        />
        <p>
          For an alternative view, gridded screening is used instead of treating DBSCAN clusters as safety hotspots. At a coarse grid
          resolution, the highest-count cell contains 2,409 recorded crashes over the full 21-year study period; at finer resolution, the largest
          cell contains 472. The dependence of the count on grid size demonstrates why a visual cluster is not a stable site definition. A grid
          cell is not an intersection or road segment, and changing its boundaries can change the ranking.
        </p>
        <ReferenceImageFigure
          label="Figure 4.2"
          caption="Supplementary county-screened spatial layers and grid summaries. All are historical counts; no exposure adjustment or verified segment/intersection assignment is claimed."
          page={27}
          itemId="report_figure_4_2"
          reason={MAP_REASON}
        />
        <RoundedGridMap />
        <Example>
          <p>
            A county map with a bright concentration near a town centre might help an engineer decide which district to inspect first. Before
            labelling one intersection “the most dangerous,” the team would match reports to an actual road network, account for traffic volume
            and use a stable site definition. The map is a first-pass conversation aid, not the final ranking.
          </p>
        </Example>
      </S>
      <S number="4.5" title="What is missing for a true site-risk model">
        <p>
          The source has route, segment and offset references, but route is present for 58.88% of records, segment for 55.70% and offset for
          61.40%. The available data do not provide a reviewed, unique crash-to-site crosswalk, a complete panel of sites including zero-crash
          years, or aligned annual traffic exposure. Without those pieces, the data can describe locations and counts but cannot support a
          defensible site-frequency rate model.
        </p>
        <p>
          A conditional Empirical Bayes screen would additionally require an approved, calibrated safety-performance function compatible with
          the road facility type and study population. A countermeasure scenario would need a sourced crash modification factor and a baseline
          matched to the relevant facility and crash type. These inputs determine whether a result can be interpreted as a safety estimate. We
          therefore do not report those calculations.
        </p>
        <Example>
          <p>
            If an analyst builds a table only from roads where a crash happened, quiet roads disappear from the denominator. A high-count road may
            then look exceptional even though it carries far more traffic. A complete inventory of eligible sites, including years with zero
            crashes, plus traffic exposure is what allows a fairer frequency comparison.
          </p>
        </Example>
        <p className="text-sm">
          Evidence gates for the analyses not run: <Link className="link" to="/appendices#table-g-4">Table G.4</Link>.
        </p>
      </S>
    </ChapterLayout>
  );
}

export function Chapter5() {
  return (
    <ChapterLayout
      eyebrow="Chapter 5"
      title="Model Fitting"
      pages="18–21"
      lead="Retrospective severity classification of already-reported crashes, evaluated chronologically. These models do not predict whether or where a crash will occur."
      toc={toc([['5.1', 'Outcome and evaluation design'], ['5.2', 'Preprocessing and classifiers'], ['5.3', 'Model comparison'], ['5.4', 'Calibration and uncertainty'], ['5.5', 'Supplementary crash archetypes'], ['5.6', 'Regression and count-modelling scope']])}
      prev={{ to: '/feature-engineering', label: 'Feature Engineering' }}
      next={{ to: '/conclusion', label: 'Chapter 6: Conclusion & Future Scope' }}
    >
      <Callout kind="caution" title="Review status">
        All results on this page come from saved evaluation artifacts of the export run; no model is run in your browser or on a server. The
        fitted models remain <strong>NOT_APPROVED_FOR_PRODUCTION</strong> review artifacts and are not offered as a prediction service.
      </Callout>
      <S number="5.1" title="Outcome and evaluation design">
        <p>
          The classification task asks whether a model can rank the severity of a crash that has already been reported. The model does not
          predict the occurrence of a crash. Records with unknown severity are excluded; the binary outcome uses the same definition as the
          common-era association work. The enhanced comparison uses training years 2016–2021 and a chronological test set covering 2022–2024. It
          includes 58,660 training records and 27,697 test records. Serious/fatal prevalence in the test set is 4.44%.
        </p>
        <p>
          A chronological split is more realistic than randomly mixing years when the question concerns later records. It is still not a
          wholly independent external validation: this time window had also been examined during model development. We therefore describe it as
          a held-out later period within this project, not as definitive evidence of deployment performance.
        </p>
        <Example>
          <p>
            A model that learns from earlier years and is checked on later years faces reporting and condition changes it has not seen during
            fitting. Randomly mixing every year into both groups would make the test easier by putting records from the same periods on both
            sides. A time split is still imperfect, but it better matches the question “how does this model travel forward in time?”
          </p>
        </Example>
      </S>
      <S number="5.2" title="Preprocessing and classifiers">
        <p>
          The Random Forest benchmark uses a pipeline that imputes categorical fields with their training-set most frequent value, one-hot
          encodes those categories and imputes the numeric speed limit with a training-set median. The main comparison includes Logistic
          Regression, Random Forest and HistGradientBoosting, with and without collision type for the Random Forest ablation. Injury counts and
          direct outcome fields are not predictors.
        </p>
        <p>
          Because serious/fatal outcomes are uncommon, accuracy can be misleading. A majority-class model achieves 95.6% accuracy while having
          balanced accuracy 0.50 and average precision 0.044, equal to the event prevalence. The Random Forest benchmark improves average
          precision only slightly to 0.052, while its accuracy falls to 71.6%. This is a useful warning against describing accuracy alone as
          successful classification.
        </p>
        <Example>
          <p>
            If roughly 95 of every 100 eligible reports are in the “other known severity” group, a rule that always says “other” will be correct
            most of the time. That sounds impressive until we ask whether it finds serious/fatal cases. Comparing the model with this simple rule
            shows why accuracy must be read together with minority-class and ranking measures.
          </p>
        </Example>
      </S>
      <S number="5.3" title="Model comparison">
        <p>
          Among the enhanced models with collision type, HistGradientBoosting has the highest average precision (0.1548), Random Forest has
          0.1420 and Logistic Regression has 0.1393. Logistic Regression has the highest ROC-AUC (0.6990), narrowly above HistGradientBoosting
          (0.6921) and Random Forest (0.6900). The Random Forest without collision type performs close to the baseline (average precision 0.0517;
          ROC-AUC 0.5461). This ablation suggests that collision type carries considerable information for distinguishing severity within known
          crashes. Since collision type is recorded after the event, that gain is retrospective rather than a pre-crash warning capability.
        </p>
        <Table5_1 />
        <Figure5_1 />
        <p>
          When only the top 5% of test records are selected for review, HistGradientBoosting identifies 310 serious/fatal cases among 1,385
          flagged records (22.38% precision; 25.18% recall). At the top 10%, it identifies 416 among 2,770 (15.02% precision; 33.79% recall); at
          the top 20%, 571 among 5,540 (10.31% precision; 46.39% recall). This trade-off is intuitive: a wider review net captures more severe
          cases but includes more non-severe crashes. The figures describe this test set only; they do not prescribe a threshold for
          public-safety action.
        </p>
        <Example>
          <p>
            Adding collision type may help sort already reported crashes by eventual severity. That can be useful for retrospective review, but
            the collision label is not available before the event. The improvement answers “which reported crashes were severe?” more than “which
            road user is about to crash?”
          </p>
        </Example>
        <p className="text-sm">
          Queue results for every model: <Link className="link" to="/appendices#table-f-1">Table F.1</Link>.
        </p>
      </S>
      <S number="5.4" title="Calibration and uncertainty">
        <p>
          The enhanced models also report probability-calibration measures and warns that class-weighted probabilities are not automatically
          calibrated. Brier scores for the enhanced models range from 0.1711 to 0.2132, and none should be treated as a ready-to-use risk
          probability without further calibration and assessment. A score that ranks cases reasonably can still misstate absolute probability.
        </p>
        <p>
          The workflow also includes temporal calibration and block-uncertainty checks. A later-year holdout from the same source is not
          equivalent to a new county or a prospective deployment trial. Threshold selection, calibration and independent validation should be
          conducted on data not used to revise the model.
        </p>
        <Example>
          <p>
            A triage list can place more severe cases near the top while still assigning poor absolute probabilities. If a dashboard says “20%
            chance” to an agency, that number should correspond to observed frequencies in a carefully validated group. Until calibration is
            checked on fresh data, it is safer to treat model scores as ranking aids for research, not individual risk statements.
          </p>
        </Example>
        <Disclosure summary="Supplementary diagnostics from the saved evaluation artifacts (not report figures)">
          <p className="mb-2 text-ink-soft">
            These views come from the notebook’s supplementary evaluation exports. They add detail to §5.3–5.4 and do not change the report’s
            conclusions.
          </p>
          <UncertaintyFigure />
          <CalibrationFigure />
          <CurvesFigure />
          <PermutationFigure />
          <h4 className="mt-6 font-semibold">Confusion matrices at the illustrative 0.50 threshold</h4>
          <div className="mt-2"><ConfusionTables /></div>
        </Disclosure>
      </S>
      <S number="5.5" title="Supplementary crash archetypes">
        <p>
          We also fit MiniBatch K-Means to a mixed representation of contextual variables over 2016–2023. Four clusters are selected from the
          tested candidates of four, six and eight clusters. Their sampled silhouette score is 0.1172, and the reported adjusted Rand index
          between two independently seeded partitions is 0.826. The silhouette score is low, so these groups should not be described as
          naturally separated crash types. The ARI suggests that the same broad partition can recur under the chosen procedure, but it does not
          establish that the clusters are substantively useful.
        </p>
        <p>
          Severity was excluded from cluster formation and profiled afterward. The largest group contains 38,811 records, while the smallest
          contains 17,472. Their serious/fatal shares range from 3.16% to 5.28%. One group is mostly angle collisions and another mostly
          fixed-object collisions, which makes the output a potentially useful descriptive summary—not a site-risk ranking.
        </p>
        <Figure5_2 />
        <Example>
          <p>
            A cluster may collect records that tend to share daylight, a collision category and a roadway context. That can make a useful slide
            for exploratory discussion. It does not mean the county has discovered a new scientific class of crash, nor that every record in the
            group needs the same treatment. Analysts should examine whether the pattern is stable and meaningful before giving it a label.
          </p>
        </Example>
      </S>
      <S number="5.6" title="Regression and count-modelling scope">
        <p>
          A crash-occurrence regression requires a defined count unit and exposure measure. This dataset does not contain a complete site-year
          panel with zero-crash locations or a compatible exposure denominator, so no site-year Poisson or Negative Binomial frequency model was
          fitted.
        </p>
        <p>
          The logistic regression described above models the binary severity of a reported crash; it is not a model of how many crashes occur.
          Similarly, the spatial grid counts do not become an incidence model merely because they are grouped into cells. A later project could
          estimate counts by site-year with an exposure offset, but only after building and reviewing the required panel.
        </p>
        <Example>
          <p>
            A supervisor may ask which ten road segments deserve a safety review. With crash locations alone, the analyst can show where reports
            accumulated, but cannot fairly compare a quiet rural road and a heavily travelled urban street. Pausing the model until a site
            inventory and traffic measure are available is more useful than presenting a precise but unsupported rank.
          </p>
        </Example>
      </S>
    </ChapterLayout>
  );
}

export function Chapter6() {
  return (
    <ChapterLayout
      eyebrow="Chapter 6"
      title="Conclusion & Future Scope"
      pages="22–24"
      lead="Findings with their interpretive boundaries, practical implications, challenges and a responsible next phase."
      toc={toc([['6.1', 'Findings and observations'], ['6.2', 'Practical implications'], ['6.3', 'Challenges'], ['6.4', 'Future plan'], ['6.5', 'Closing note']])}
      prev={{ to: '/model-fitting', label: 'Model Fitting' }}
      next={{ to: '/appendices', label: 'Appendices' }}
    >
      <S number="6.1" title="Findings and observations">
        <p>The analysis supports several findings, each with a boundary on its interpretation.</p>
        <ol>
          <li>The dataset is internally consistent on basic identity checks: 248,810 rows, 248,810 unique crash reference numbers, and no exact duplicate records were reported. This gives a reproducible starting point, not a guarantee of complete or error-free reporting.</li>
          <li>Severity is not known for every record. The binary outcome uses 205,544 records with codes 0–4; unknown values are excluded rather than treated as non-severe.</li>
          <li>The 2016 severity-standard break and 2024 time/illumination coverage collapse materially limit trend and context comparisons. The common-era analysis uses 2016–2023; valid time coverage in 2024 is only 387 of 10,228 records.</li>
          <li>Conditional serious/fatal shares differ by recorded crash context. Pedestrian and head-on crashes have notably higher shares than rear-end or angle crashes in the common-era table. These are among reported crashes, not rates per pedestrian trip, vehicle-mile or roadway site.</li>
          <li>The logistic model retains an adjusted association between crash type and severity. Pedestrian and head-on categories have larger odds relative to angle crashes, but no coefficient in this observational model proves causation.</li>
          <li>The enhanced classifier ranks the later held-out serious/fatal cases better than the majority baseline, particularly when collision type is included. Average precision remains 0.14–0.15 rather than indicating a highly discriminative model, and the feature that improves performance is recorded after the crash.</li>
          <li>Geographic screening reveals historical concentrations, but without road-network attribution and traffic exposure those are locations of more reports, not validated high-risk sites.</li>
          <li>Exposure-based site counts, Empirical Bayes screening and countermeasure what-if calculations remain unrun because their required reviewed inputs were absent. No effect size or reduction percentage was invented.</li>
        </ol>
      </S>
      <S number="6.2" title="Practical implications">
        <p>
          The results can help a safety team decide what to examine next. They do not answer every operational question on their own; the table
          links common questions to the evidence available here and what would still be needed.
        </p>
        <Table6_1 />
        <p>
          For example, the annual counts can identify a year worth examining, while traffic volume and reporting changes are needed before
          interpreting the count as a change in risk.
        </p>
      </S>
      <S number="6.3" title="Challenges">
        <p>
          The largest challenge was not computation; it was deciding when not to interpret. Long-term severity comparison is complicated by a
          coding change. Missing values are field- and year-dependent. Some category groupings remain uncertain without historical codebooks.
          The record contains multiple coordinate sources with different formats, and candidate agreement is not enough to establish official
          provenance. Serious/fatal outcomes are rare, which makes performance metrics and threshold choices sensitive to class imbalance.
          Finally, crash reports alone do not contain a denominator for traffic exposure.
        </p>
        <p>
          Taken together, these issues limit what the records can answer. For this reason, descriptive comparisons are kept separate from risk
          estimates, and observed associations are not presented as causes.
        </p>
      </S>
      <S number="6.4" title="Future plan">
        <p>A responsible next phase would:</p>
        <ol>
          <li>Verify historical severity, weather and road-condition categories against year-specific official codebooks and document any crosswalk before re-running the analysis.</li>
          <li>Investigate the 2024 time and lighting data discontinuity with the source data steward; use a defined coverage rule before comparing this year with earlier years.</li>
          <li>Obtain a reviewed crash-to-road-segment or intersection crosswalk, with each crash assigned once and ambiguous matches retained for review.</li>
          <li>Build a complete annual site panel that includes zero-crash site-years and align it to traffic exposure such as AADT and segment length, using a suitable, independently reviewed exposure measure for intersections.</li>
          <li>Refit a site-year count model on a training period and evaluate it on later years without tuning to the test results; use a calibrated SPF before any Empirical Bayes network screening.</li>
          <li>Review classifier calibration, decision costs and external transferability. If the intended use is pre-crash prevention, redesign the question around predictors available before the event and obtain prospective or independent validation.</li>
          <li>Source countermeasure evidence from compatible studies and calculate scenarios only when the baseline, facility and crash type match the evidence. Report uncertainty rather than a single promise of reduction.</li>
        </ol>
      </S>
      <S number="6.5" title="Closing note">
        <p>
          This analysis shows which patterns are visible in the crash records and where the records stop short. Counts and maps can guide
          further investigation; they cannot show risk without traffic exposure or estimate treatment effects without suitable comparison
          evidence. The findings provide a starting point for more detailed road-safety work in Allegheny County.
        </p>
      </S>
    </ChapterLayout>
  );
}
