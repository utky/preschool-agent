-- カスタムスキーマが指定されている場合はそのまま使用する
-- デフォルトの挙動（target_schema + custom_schema）を上書きし、
-- school_agent_school_agent のような二重プレフィックスを防ぐ
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- if custom_schema_name is not none -%}
        {{ custom_schema_name | trim }}
    {%- else -%}
        {{ target.schema }}
    {%- endif -%}
{%- endmacro %}
