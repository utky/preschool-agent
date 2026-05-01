{% macro create_split_by_headings_udf() %}
CREATE OR REPLACE FUNCTION
    `{{ var('gcp_project_id') }}.{{ var('dataset_id') }}.split_by_headings`(markdown STRING)
RETURNS ARRAY<STRING>
AS (
    SPLIT(
        REGEXP_REPLACE(
            CONCAT('\n', markdown),
            r'\n(#{1,3} |[●▶]|\*[^\n*]{1,20}\*)',
            '\n<<<HSPLIT>>>\n\\1'
        ),
        '<<<HSPLIT>>>'
    )
);
{% endmacro %}
