{% macro query_comment(node) %}
{%- set comment_dict = {} -%}
{%- do comment_dict.update(
    app='dbt',
    dbt_version=dbt_version,
    profile_name=target.profile_name,
    target_name=target.name,
) -%}
{%- if node is not none -%}
  {%- do comment_dict.update(
      node_id=node.unique_id,
      node_name=node.name,
      node_resource_type=node.resource_type,
      node_package_name=node.package_name,
  ) -%}
  {%- if node.config.labels -%}
    {%- do comment_dict.update(node.config.labels) -%}
  {%- endif -%}
{%- endif -%}
{{ return(tojson(comment_dict)) }}
{% endmacro %}
