FROM python:3.12-slim

RUN pip install --no-cache-dir dbt-core dbt-bigquery

WORKDIR /dbt
COPY . .
RUN dbt deps

ENTRYPOINT ["dbt"]
CMD ["build", "--no-use-colors"]
