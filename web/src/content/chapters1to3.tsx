import { Link } from 'react-router-dom';
import { Callout } from '../components/ui';
import { ChapterLayout, Example, S, toc } from './layout';
import { Figure2_1, Figure2_2, Figure3_1, Figure3_2, Figure3_3, Figure3_4, Figure3_5, Figure3_6, Figure3_7, Figure3_8, Table3_1 } from '../research/figures';
import { Table2_1 } from '../research/tables';

export function Chapter1() {
  return (
    <ChapterLayout
      eyebrow="Chapter 1"
      title="Introduction"
      pages="1–2"
      lead="Why a measured approach to police-reported crash records, the four guiding questions, and how the results should be read."
      toc={toc([['1.1', 'Project idea and motivation'], ['1.2', 'Study objectives and questions'], ['1.3', 'Scope and interpretation'], ['1.4', 'Using crash data in practice'], ['1.5', 'Report structure']])}
      next={{ to: '/data-cleaning', label: 'Chapter 2: Data Cleaning' }}
    >
      <S number="1.1" title="Project idea and motivation">
        <p>
          Road crashes are recorded through a process that involves people, police reporting, coding rules and information systems. A
          dataset of crash reports can help describe where, when and under what circumstances recorded collisions occurred. It is also easy
          to ask too much of it. A large count beside one road does not automatically mean that road is unusually dangerous: it may carry more
          traffic, have more intersections, or simply have better reporting coverage. Likewise, a higher serious-injury share in one category
          does not show that the category caused the outcome.
        </p>
        <p>
          This project takes a deliberately measured approach. The first task is not to fit a sophisticated model; it is to determine whether
          the observations, labels and denominators support the comparisons we want to make. The analysis moves from dataset validation to
          descriptive summaries, common-era comparisons, adjusted associations, geographic concentration and chronological model evaluation.
          Where information needed for a stronger safety conclusion is missing, that gap is reported explicitly.
        </p>
      </S>
      <S number="1.2" title="Study objectives and questions">
        <p>The analysis was guided by four questions:</p>
        <ol>
          <li>What are the broad patterns in the police-reported crash records across time, severity, roadway context and people/vehicle counts?</li>
          <li>Within a consistent severity-definition period, which recorded crash circumstances are associated with a serious/fatal classification?</li>
          <li>What can the location fields support about historical spatial concentration, and what additional information would be needed to identify a site with elevated risk?</li>
          <li>Can a classifier trained on earlier records rank later reported crashes by the recorded severity outcome, and how much confidence should be placed in that result?</li>
        </ol>
        <p>
          The data also do not include the site-year exposure information or intervention evidence needed for crash-frequency modelling or
          countermeasure evaluation.
        </p>
      </S>
      <S number="1.3" title="Scope and interpretation">
        <p>
          The unit of analysis is one crash record. The study covers 248,810 police-reported crashes from 2004–2024 in the Allegheny County
          crash-data resource hosted by the Western Pennsylvania Regional Data Center (WPRDC) [1]. The records do not represent every collision
          that occurred and do not include a vehicle-miles-travelled denominator.
        </p>
        <p>
          For severity analyses, codes 1 and 2 are combined as serious/fatal; codes 0, 3 and 4 form the other known-severity class. Codes 8 and
          9, missing values and unmapped outcomes are left unknown rather than forced into either class. This binary definition supports the
          comparisons in this report but is not a substitute for a full injury-severity study.
        </p>
        <p>
          A change in the severity reporting standard in 2016 makes direct comparison of serious-injury proportions across the whole 21-year
          span unsafe. Principal association tests therefore use 2016–2023. The enhanced classifiers use the same outcome-era boundary, train on
          2016–2021 and reserve 2022–2024 for testing. The 2024 period remains in the test set for models whose retained fields are available,
          but is excluded from context comparisons where its time and illumination data are not comparable.
        </p>
      </S>
      <S number="1.4" title="Using crash data in practice">
        <p>
          Imagine a county safety team preparing a short list of places for engineering review. An exploratory map might show that more crash
          reports accumulate in a central area than elsewhere. That map can help the team ask where to look next. It cannot answer whether the
          central area has higher risk per trip, whether a particular road treatment would reduce crashes, or which location should receive
          limited funds. Those next decisions require, among other things, traffic volumes, road-network attribution and a defensible
          comparison population. The distinction between a useful lead and a validated safety finding is the main interpretive discipline of
          this report.
        </p>
      </S>
      <S number="1.5" title="Report structure">
        <p>
          <Link className="link" to="/data-cleaning">Chapter 2</Link> describes the dataset and cleaning choices.{' '}
          <Link className="link" to="/visualization">Chapter 3</Link> presents the visual and statistical analysis.{' '}
          <Link className="link" to="/feature-engineering">Chapter 4</Link> discusses feature construction and geographic results.{' '}
          <Link className="link" to="/model-fitting">Chapter 5</Link> evaluates the classification models.{' '}
          <Link className="link" to="/conclusion">Chapter 6</Link> summarises the findings and next steps. The{' '}
          <Link className="link" to="/appendices">appendices</Link> contain variable definitions and detailed results.
        </p>
      </S>
    </ChapterLayout>
  );
}

export function Chapter2() {
  return (
    <ChapterLayout
      eyebrow="Chapter 2"
      title="Data Cleaning"
      pages="3–6"
      lead="Source, structure, variable roles, integrity checks, missingness and the treatment of unknown values."
      toc={toc([['2.1', 'Source and collection process'], ['2.2', 'Dataset overview'], ['2.3', 'Variable roles and source codes'], ['2.4', 'Duplicates and logical checks'], ['2.5', 'Missingness and coverage'], ['2.6', 'Imputation and retained unknowns']])}
      prev={{ to: '/introduction', label: 'Introduction' }}
      next={{ to: '/visualization', label: 'Chapter 3: Visualization' }}
    >
      <S number="2.1" title="Source and collection process">
        <p>
          The dataset used in this project is Allegheny County Crash Data, a public resource provided by the Western Pennsylvania Regional
          Data Center (WPRDC) [1]. It contains police-reported crashes from Allegheny County, Pennsylvania.
        </p>
        <p>
          The analysis uses the original source fields and records the year range, row count and unique crash identifiers before deriving
          variables. These checks confirm the structure of the file used in the project; they do not establish that every reported field is
          correct.
        </p>
        <Example>
          <p>
            Before a transport analyst makes a chart for a meeting, they might compare the first and last year, count records and check whether
            the crash ID repeats. If a file turned out to contain only a decade of data, the annual trend could look different simply because the
            extract was incomplete. These checks do not prove every field is correct, but they prevent a basic file mix-up from becoming a
            confident-looking conclusion.
          </p>
        </Example>
      </S>
      <S number="2.2" title="Dataset overview">
        <p>
          The data are a wide administrative extract. The 191 columns include identifiers, dates and times, severity codes, environmental and
          collision codes, roadway descriptors, person/vehicle/injury counts and coordinate or linear-reference fields. Many columns are highly
          specialised and sparsely populated. The analysis does not treat every field as an equally useful feature.
        </p>
        <Table2_1 />
        <p>
          The annual record totals vary, with a low of 9,863 in 2020 and a high of 12,908 in 2016. These changes should not be called changes
          in crash risk: the dataset does not include exposure and annual reporting or traffic conditions may differ. The year counts are useful
          for checking coverage and setting time windows, not for claiming that one year was safer than another.
        </p>
        <Example>
          <p>
            A spreadsheet may store weather as 1, 2 and 3. Taking the average and reporting 2.1 would not mean that the weather was “slightly
            more cloudy”; the numbers name categories. A road-safety analyst would first consult the codebook, then compare category counts or
            percentages. The same reasoning keeps crash IDs out of correlation charts.
          </p>
        </Example>
      </S>
      <S number="2.3" title="Variable roles and source codes">
        <p>
          Data types alone do not tell us how a field should be analysed. For example, a numeric weather code is still a category label; taking
          its mean would be meaningless. For analysis, severity, illumination, weather, collision type, relation to road and intersection type
          are treated as categorical fields. Counts and measurements include people, vehicles, injuries and speed limit. Crash reference numbers
          and row IDs are identifiers, not measurements. Identifiers were excluded from averages, correlations and predictors.
        </p>
        <p>
          The study preserves uncertainty around historical category mappings. Weather and road-surface labels can be useful for descriptive
          inspection, but historical codebook changes remain unverified. Those provisional groupings are therefore not used in the formal
          inference or classifier feature sets. The source field URBAN_RURAL is also left out of models because its coded values were not
          validated for interpretation.
        </p>
        <Example>
          <p>
            A field stored as a number is not always a measurement: averaging codes for weather or intersection type is like averaging bus-route
            numbers. An analyst first decides whether a column is a label, a count, a measurement or an identifier; only then does the choice of
            chart or statistic make sense.
          </p>
        </Example>
        <p className="text-sm">
          Field roles are listed in <Link className="link" to="/appendices#sec-A">Appendix A (Table A.1)</Link>.
        </p>
      </S>
      <S number="2.4" title="Duplicates and logical checks">
        <p>
          No exact duplicate row or repeated crash reference number was reported, so no observations were removed from the working data. This
          is a positive integrity check, but it only addresses duplication; it does not establish that every field on each unique record is
          correct.
        </p>
        <p>
          We also checked whether recorded injury counts reconcile with injury components and whether basic count constraints are violated. The
          check surfaced occasional inconsistencies, mostly small, and a clear reporting change: the total-injury field is available for only
          36.57% of rows overall, while it is absent for much of the later period. Injury counts were not used as classifier inputs because they
          are outcomes of the crash and would leak information into a severity model. The project retains unusual values for review rather than
          automatically deleting them.
        </p>
        <Example>
          <p>
            If one crash is accidentally entered twice, a busy junction can appear to have two events when there was only one. Checking unique
            crash references helps catch that specific problem. A separate check such as fatalities exceeding the number of people recorded can
            flag a row for review; it should not automatically delete a record, because unusual entries may reflect a different recording
            convention.
          </p>
        </Example>
        <p className="text-sm">
          Year-by-year reconciliation results: <Link className="link" to="/appendices#table-a-2">Table A.2</Link>.
        </p>
      </S>
      <S number="2.5" title="Missingness and coverage">
        <p>
          Missingness is highly uneven across fields. Work-zone attributes such as special jurisdiction and surface type are over 99% missing;
          estimated closure hours are 65.25% missing; total injury count is 63.43% missing; route is 41.12% missing; segment is 44.30% missing;
          and offset is 38.60% missing. By contrast, speed limit and lane count are present in about 94% of records. A blank in a field is not
          automatically a zero, a negative response or proof that the condition was absent.
        </p>
        <p>
          The joint missingness review provides another useful detail: 216,378 records had none of the selected key fields missing, 12,380 had
          one missing, 18,457 had two missing, 1,577 had three missing and 18 records had four or five selected fields missing. This count
          describes the chosen fields only, not all 191 columns. It also does not identify whether the missingness is random. The report
          therefore avoids assigning MCAR, MAR or MNAR labels on the basis of a heatmap alone.
        </p>
        <Figure2_1 />
        <Figure2_2 />
        <p>
          A conspicuous break occurs in 2024. Only 387 of 10,228 records have a valid recorded hour (about 3.8%), and the illumination field is
          entirely unavailable. The annual dataset still contains records for 2024, but time-of-day and lighting comparisons cannot treat that
          year as ordinary. For this reason, time/illumination association results stop at 2023, while the chronological classifier comparison
          uses fields available across its full holdout.
        </p>
        <Example>
          <p>
            If a work-zone field is empty, it may mean there was no work zone, the officer did not know, or the field was not collected that
            year. A planner deciding whether to study work-zone safety would first ask how the field was captured and when. Treating every blank
            as “no work zone” would quietly turn missing documentation into a factual claim.
          </p>
        </Example>
      </S>
      <S number="2.6" title="Imputation and retained unknowns">
        <p>
          There is no blanket imputation step in the descriptive dataset. Unknown severity remains unknown. Missing environmental or roadway
          context is not silently recoded as an affirmative category. The supervised pipelines do use training-fitted imputation where needed:
          most-frequent values for categorical predictors and a median for the numeric speed-limit feature. Fitting the imputer inside a
          scikit-learn pipeline keeps test-period information out of preprocessing estimates.
        </p>
        <p>
          This distinction is important. Imputation is an operational requirement for a model, not a claim that the filled value is what
          actually happened at the crash scene. The report gives missingness and coverage separately so that model results are not mistaken
          for a complete view of all records.
        </p>
        <Example>
          <p>
            A prediction pipeline can fill an unrecorded speed limit with a typical value learned from its training records so it can produce a
            score. That substitute is not evidence that the road actually had that speed limit. Keeping unknown categories visible in descriptive
            results prevents a modelling convenience from being mistaken for a recovered fact.
          </p>
        </Example>
      </S>
    </ChapterLayout>
  );
}

export function Chapter3() {
  return (
    <ChapterLayout
      eyebrow="Chapter 3"
      title="Visualization"
      pages="7–14"
      lead="Severity composition, time patterns and the 2016 boundary, recorded context, count distributions, common-era conditional shares, formal tests and the adjusted logistic association model."
      toc={toc([['3.1', 'Severity composition'], ['3.2', 'Time patterns and the 2016 boundary'], ['3.3', 'Recorded collision and roadway context'], ['3.4', 'People, vehicles and count distributions'], ['3.5', 'Common-era conditional severity comparisons'], ['3.6', 'Formal categorical association tests'], ['3.7', 'Adjusted logistic association model']])}
      prev={{ to: '/data-cleaning', label: 'Data Cleaning' }}
      next={{ to: '/feature-engineering', label: 'Chapter 4: Feature Engineering' }}
    >
      <S number="3.1" title="Severity composition">
        <p>
          The source severity distribution is strongly imbalanced. Property-damage-only crashes form the largest labelled group, followed by
          possible-injury cases. The serious-injury and fatal categories are much smaller. Some rows have injury severity or injury status
          unknown; these categories remain visible in descriptive summaries but are excluded from the binary outcome calculations.
        </p>
        <Figure3_1 />
        <p>
          Overall, 205,544 records (82.61%) have a severity value in the known 0–4 set used for binary classification; 43,266 records are
          outside that outcome set or unresolved. A missing/unknown outcome is not equivalent to a non-severe crash. This choice reduces the
          analysis denominator but prevents the outcome from being invented.
        </p>
        <Example>
          <p>
            If a report groups property-damage-only and injury crashes into broad categories, a reader should notice that the serious/fatal
            classes are much smaller. A model that gets the large category right most of the time might still miss the cases of greatest
            interest. That imbalance is why this report separates the source-label chart from the binary target and its evaluation measures.
          </p>
        </Example>
      </S>
      <S number="3.2" title="Time patterns and the 2016 boundary">
        <p>
          Reported crash counts by year are broadly in the same order of magnitude through most of the series, with a visible dip in 2020 and
          lower totals in 2023–2024. Monthly counts and weekday/hour distributions offer a descriptive sense of when records are concentrated.
          They are counts of reported crashes, not rates per hour of traffic or per mile travelled.
        </p>
        <Figure3_2 />
        <p>
          Fatal-share trends are shown separately from serious/fatal trends because the 2016 reporting-standard change affects how serious
          injury is classified. It also examines raw time heaping. The 02:00 record concentration can reflect reporting conventions or default
          time coding as well as actual events; it is not interpreted as a reliable peak in risk.
        </p>
        <Figure3_3 />
        <p>
          The narrative lesson from these plots is less about a dramatic annual trajectory and more about comparability. A longer series is not
          automatically a better trend series when the definition changes partway through it. We use 2016 onward for principal serious/fatal
          comparisons and keep the 2004–2015 records for descriptive continuity where appropriate.
        </p>
        <Example>
          <p>
            Imagine a hospital changing how it classifies injury severity halfway through a decade. A chart might show more “serious” cases
            after the change even if the underlying events did not change by the same amount. The analyst would mark the break and compare
            periods with consistent definitions rather than drawing one smooth line through unlike categories.
          </p>
        </Example>
      </S>
      <S number="3.3" title="Recorded collision and roadway context">
        <p>
          The most common recorded collision categories include angle, fixed-object and rear-end crashes. The analysis also summarizes road
          relation, intersection and urban/rural fields, while retaining unknown categories. These distributions describe the composition of
          the crash reports, not the frequency of those conditions in all roadway travel.
        </p>
        <Figure3_4 />
        <p>
          A useful example is the difference between the number of crashes in a category and the share that are serious or fatal within that
          category. Rear-end crashes are numerous in the common-era table but have a lower conditional serious/fatal share than head-on or
          pedestrian crashes. Neither statement, by itself, measures risk per exposure. Both are descriptive views of the reported-crash subset.
        </p>
        <Example>
          <p>
            A city might receive many reports of minor rear-end collisions on a busy commuter route and fewer head-on reports. The first count
            tells staff what appears often in the report system; a within-category severity share tells them something about the composition of
            those reported crashes. Neither gives a per-vehicle risk without knowing how much traffic used each road.
          </p>
        </Example>
      </S>
      <S number="3.4" title="People, vehicles and count distributions">
        <p>
          The average crash record includes 2.40 people and 1.83 vehicles; medians are two people and two vehicles. Counts are skewed: a typical
          crash contains few people and vehicles, while a small number of records include unusually large counts. We retained these upper-tail
          observations because an IQR flag is not proof of a data error. IQR screening flagged 4,652 records for person count, 7,189 for vehicle
          count and 7,287 for injury count in the selected data.
        </p>
        <Figure3_5 />
        <Example>
          <p>
            A crash report listing ten people may be unusual but could involve a bus or a van. An analyst should check that record against the
            source definition instead of trimming every value above a statistical fence. The question is whether the observation is plausible and
            accurately recorded, not whether it looks like the median case.
          </p>
        </Example>
        <p>
          Pearson and Spearman correlations are shown only for quantities and measurements, not for arbitrary codes or identifiers. Count fields
          can be mechanically related because they refer to the same crash. The strong associations among person, vehicle and injury counts
          should therefore be read as co-movement in the record, not as evidence that a count causes another count.
        </p>
        <Figure3_6 />
        <Example>
          <p>
            In one crash record, a larger number of vehicles can naturally be accompanied by more people and possible injuries. A strong
            correlation among those columns may simply describe the same event from several angles. It does not show that adding a vehicle to an
            already occurred crash would cause an injury; the measure is descriptive, not an intervention estimate.
          </p>
        </Example>
      </S>
      <S number="3.5" title="Common-era conditional severity comparisons">
        <p>
          For a fairer comparison, the main category tables use 2016–2023 known-severity records. There are 77,476 such records, of which 3,233
          (4.17%) are serious or fatal. The denominator is explicit: each percentage is the share of known-severity crashes in that category
          which are classified serious/fatal. It is not the chance that a trip, road user or roadway segment will experience a severe crash.
        </p>
        <p>
          The differences across collision types are substantial in the reported records. Serious/fatal share is 26.87% for pedestrian crashes
          (496 of 1,846), 9.48% for head-on crashes (383 of 4,042), 8.38% for noncollision crashes (141 of 1,683), 4.74% for fixed-object crashes
          (960 of 20,257), 3.33% for angle crashes (697 of 20,940), and 1.74% for rear-end crashes (350 of 20,066). The small pedestrian
          denominator compared with common collision classes makes the magnitude important but not a direct comparative risk rate. The result is
          best understood as a reason to examine pedestrian safety conditions carefully, not as a standalone estimate of treatment effect.
        </p>
        <Figure3_7 />
        <p>
          Night-time records have a 5.86% serious/fatal share (955/16,295), compared with 3.78% in the afternoon (885/23,397) and 3.16% in the
          morning (649/20,565). Dark, no-streetlight conditions have a 5.37% share (255/4,745); daylight has 3.65% (1,757/48,209). These
          descriptive differences may reflect interacting factors, including road type, traffic mix, speed, location, time recording and
          severity reporting. They should not be converted into a claim that darkness caused the observed difference.
        </p>
        <Example>
          <p>
            Suppose a community group hears that a certain crash type has a high serious-injury percentage. The first follow-up question should
            be “out of how many known-severity reports?” A category with a small denominator can have a volatile percentage. A second question is
            “how many people travelled in those conditions?” Without that exposure denominator, the percentage is a description of reported
            crashes, not a per-trip danger estimate.
          </p>
        </Example>
        <p className="text-sm">
          Full category tables with every denominator: <Link className="link" to="/appendices#sec-E">Appendix E</Link>.
        </p>
      </S>
      <S number="3.6" title="Formal categorical association tests">
        <p>
          We used chi-square tests of independence for collision type, illumination, time period and intersection category, on the 77,476
          known-severity records from 2016–2023. It pools low-frequency categories where needed and reports Cramér V as an effect-size measure.
          Weather and road-surface tests are withheld because their historical group mappings have not been verified.
        </p>
        <Table3_1 />
        <p>
          The large sample sizes mean that even modest associations can yield small p-values. Cramér V helps separate statistical detectability
          from magnitude: collision type has the clearest association in this set, while time, illumination and intersection effects are much
          smaller by this measure. The chi-square results do not show direction or causality, and category pooling changes the precise
          interpretation of the pooled levels. Four tested families were corrected using the Benjamini–Hochberg procedure.
        </p>
        <Example>
          <p>
            With tens of thousands of records, a modest difference between morning and afternoon may be statistically detectable. A planning
            meeting should still ask whether the difference is large enough to matter operationally and whether it survives definition checks.
            That is why the report gives Cramér’s V alongside the chi-square result rather than using the p-value alone as a headline.
          </p>
        </Example>
      </S>
      <S number="3.7" title="Adjusted logistic association model">
        <p>
          A binomial logistic regression offers a complementary view by comparing odds conditional on a set of recorded variables. The fitted
          model uses 77,476 records and 3,233 serious/fatal outcomes from 2016–2023. It includes collision type, illumination, time period,
          intersection type, month and year fixed effects; sparse levels are pooled. Odds ratios are reported with HC0 robust confidence
          intervals, and q-values use Benjamini–Hochberg adjustment.
        </p>
        <Callout kind="note" title="Export note">
          The exported v6 model formula also includes the validated speed-limit term (SPEED_LIMIT_VALID), which the sentence above does not
          enumerate. The exported formula is the exact one that was fitted; this difference is documented by the export verification.
          Two confidence limits in the next paragraph are printed slightly differently from the exported estimates: the pedestrian upper
          limit is 12.0946 (12.09 at two decimals; printed 12.10) and the rear-end lower limit is 0.3949 (0.39; printed 0.40). The figure and
          its table below show the exported values; the report wording is kept unchanged.
        </Callout>
        <p>
          Compared with angle collisions, the adjusted odds ratio is 10.63 for pedestrian crashes (95% CI 9.35–12.10; q &lt; 0.001), 2.74 for
          head-on crashes (2.41–3.13; q &lt; 0.001), and 2.14 for noncollision crashes (1.77–2.60; q &lt; 0.001). Rear-end crashes have lower
          adjusted odds relative to angle collisions (OR 0.45; 0.40–0.52; q &lt; 0.001). Compared with afternoon records, night records have OR
          1.25 (1.05–1.48; q = 0.025), while morning records have OR 0.82 (0.74–0.92; q = 0.002). The dark/no-streetlight term has OR 1.20, but
          its adjusted q-value is 0.077; after correction, this estimate does not meet the conventional 0.05 threshold.
        </p>
        <Figure3_8 />
        <p>
          An odds ratio is not a percentage-point change in probability. The model also conditions on a reported crash and on fields that were
          recorded; it cannot establish what would happen if a roadway or behaviour were changed. Pedestrian crash severity may motivate a deeper
          safety review, but evaluating an intervention would require a suitable design, exposure measures and credible counterfactual evidence.
        </p>
        <Example>
          <p>
            A regression can compare recorded pedestrian and angle crashes while holding other listed fields constant. It cannot recreate the
            unobserved traffic, road design, behaviour or reporting process for each event. A transport team might use the estimate to decide what
            to investigate next, but it would need a suitable study design before claiming that a particular intervention would reduce severity
            by the same amount.
          </p>
        </Example>
      </S>
    </ChapterLayout>
  );
}
