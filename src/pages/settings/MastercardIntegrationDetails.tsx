import { gql } from '@apollo/client'
import { Icon } from 'lago-design-system'
import { useMemo } from 'react'
import { generatePath, useParams } from 'react-router'

import { Alert } from '~/components/designSystem/Alert'
import { Button } from '~/components/designSystem/Button'
import { Skeleton } from '~/components/designSystem/Skeleton'
import { Tooltip } from '~/components/designSystem/Tooltip'
import { Typography } from '~/components/designSystem/Typography'
import { IntegrationsPage } from '~/components/layouts/Integrations'
import { MainHeader } from '~/components/MainHeader/MainHeader'
import { useAddMastercardDialog } from '~/components/settings/integrations/AddMastercardDialog'
import { useDeleteMastercardIntegrationDialog } from '~/components/settings/integrations/DeleteMastercardIntegrationDialog'
import {
  isMastercardRegion,
  MASTERCARD_REGION_TRANSLATION_KEYS,
} from '~/components/settings/integrations/mastercardRegions'
import { addToast, envGlobalVar } from '~/core/apolloClient'
import { IntegrationsTabsOptionsEnum } from '~/core/constants/tabsOptions'
import { INTEGRATIONS_ROUTE, MASTERCARD_INTEGRATION_ROUTE, useNavigate } from '~/core/router'
import { copyToClipboard } from '~/core/utils/copyToClipboard'
import {
  MastercardIntegrationDetailsFragment,
  ProviderTypeEnum,
  useMastercardIntegrationDetailsQuery,
} from '~/generated/graphql'
import { useInternationalization } from '~/hooks/core/useInternationalization'
import { useCurrentUser } from '~/hooks/useCurrentUser'
import { usePermissions } from '~/hooks/usePermissions'
import Mastercard from '~/public/images/mastercard.svg'

const PROVIDER_CONNECTION_LIMIT = 2

gql`
  fragment MastercardIntegrationDetails on MastercardProvider {
    id
    name
    code
    merchantId
    apiPassword
    webhookSecret
    region
    testMode
  }

  query mastercardIntegrationDetails($id: ID!, $limit: Int, $type: ProviderTypeEnum) {
    paymentProvider(id: $id) {
      ... on MastercardProvider {
        id
        ...MastercardIntegrationDetails
      }
    }

    paymentProviders(limit: $limit, type: $type) {
      collection {
        ... on MastercardProvider {
          id
        }
      }
    }
  }
`

const MastercardIntegrationDetails = () => {
  const navigate = useNavigate()
  const { integrationId } = useParams()
  const { hasPermissions } = usePermissions()
  const { openAddMastercardDialog } = useAddMastercardDialog()
  const { openDeleteMastercardIntegrationDialog } = useDeleteMastercardIntegrationDialog()
  const { apiUrl } = envGlobalVar()
  // The org id is baked into a webhook URL pasted into Mastercard: read it from the
  // slug-driven membership, not `useOrganizationInfos` (cross-tab Apollo cache).
  const { currentMembership } = useCurrentUser()
  const currentOrganizationId = currentMembership?.organization.id || ''
  const { translate } = useInternationalization()
  const { data, loading } = useMastercardIntegrationDetailsQuery({
    variables: {
      id: integrationId as string,
      limit: PROVIDER_CONNECTION_LIMIT,
      type: ProviderTypeEnum.Mastercard,
    },
    skip: !integrationId,
  })
  const mastercardPaymentProvider = data?.paymentProvider as MastercardIntegrationDetailsFragment

  const deleteDialogCallback = () => {
    if ((data?.paymentProviders?.collection.length || 0) >= PROVIDER_CONNECTION_LIMIT) {
      navigate(
        generatePath(MASTERCARD_INTEGRATION_ROUTE, {
          integrationGroup: IntegrationsTabsOptionsEnum.Community,
        }),
      )
    } else {
      navigate(
        generatePath(INTEGRATIONS_ROUTE, {
          integrationGroup: IntegrationsTabsOptionsEnum.Community,
        }),
      )
    }
  }

  const canEditIntegration = hasPermissions(['organizationIntegrationsUpdate'])
  const canDeleteIntegration = hasPermissions(['organizationIntegrationsDelete'])

  const webhookUrl = useMemo(
    () =>
      `${apiUrl}/webhooks/mastercard/${currentOrganizationId}?code=${mastercardPaymentProvider?.code}`,
    [apiUrl, currentOrganizationId, mastercardPaymentProvider?.code],
  )

  const getRegionLabel = (): string | undefined => {
    const region = mastercardPaymentProvider?.region

    if (!isMastercardRegion(region)) return region ?? undefined

    return translate(MASTERCARD_REGION_TRANSLATION_KEYS[region])
  }

  if (!integrationId) return null

  return (
    <div>
      <MainHeader.Configure
        breadcrumb={[
          {
            label: translate('text_62b1edddbf5f461ab9712750'),
            path: generatePath(INTEGRATIONS_ROUTE, {
              integrationGroup: IntegrationsTabsOptionsEnum.Community,
            }),
          },
          {
            label: translate('text_1791490426176do7yw15mhfd'),
            path: generatePath(MASTERCARD_INTEGRATION_ROUTE, {
              integrationGroup: IntegrationsTabsOptionsEnum.Community,
            }),
          },
        ]}
        entity={{
          viewName: mastercardPaymentProvider?.name || '',
          viewNameLoading: loading,
          metadata: translate('text_17914904261772fks3jkh49n'),
          metadataLoading: loading,
          badges: [{ type: 'default', label: translate('text_1791490426176do7yw15mhfd') }],
          icon: <Mastercard />,
        }}
        actions={{
          items: [
            {
              type: 'dropdown',
              label: translate('text_626162c62f790600f850b6fe'),
              items: [
                {
                  label: translate('text_65845f35d7d69c3ab4793dac'),
                  hidden: !canEditIntegration,
                  onClick: (closePopper) => {
                    openAddMastercardDialog({
                      provider: mastercardPaymentProvider,
                      deleteCallback: deleteDialogCallback,
                    })
                    closePopper()
                  },
                },
                {
                  label: translate('text_65845f35d7d69c3ab4793dad'),
                  hidden: !canDeleteIntegration,
                  onClick: (closePopper) => {
                    openDeleteMastercardIntegrationDialog({
                      provider: mastercardPaymentProvider,
                      callback: deleteDialogCallback,
                    })
                    closePopper()
                  },
                },
              ],
            },
          ],
          loading,
        }}
      />

      <div className="mb-12 flex max-w-[672px] flex-col gap-8 px-4 py-0 md:px-12">
        <Alert type="warning">{translate('text_1733303404277q80b216p5zr')}</Alert>

        <section>
          <div className="flex h-18 w-full items-center justify-between">
            <Typography className="flex h-18 w-full items-center" variant="subhead1">
              {translate('text_664c732c264d7eed1c74fdc5')}
            </Typography>

            {canEditIntegration && (
              <Button
                variant="quaternary"
                align="left"
                onClick={() => {
                  openAddMastercardDialog({
                    provider: mastercardPaymentProvider,
                    deleteCallback: deleteDialogCallback,
                  })
                }}
              >
                {translate('text_62b1edddbf5f461ab9712787')}
              </Button>
            )}
          </div>
          {loading && (
            <>
              {[0, 1, 2].map((i) => (
                <IntegrationsPage.ItemSkeleton key={`item-skeleton-${i}`} />
              ))}
              <div style={{ height: 24 }} />
              <Skeleton className="mb-4 w-60" variant="text" />
            </>
          )}
          {!loading && (
            <>
              <IntegrationsPage.DetailsItem
                icon="text"
                label={translate('text_626162c62f790600f850b76a')}
                value={mastercardPaymentProvider.name}
              />
              <IntegrationsPage.DetailsItem
                icon="id"
                label={translate('text_62876e85e32e0300e1803127')}
                value={mastercardPaymentProvider.code}
              />
              <IntegrationsPage.DetailsItem
                icon="key"
                label={translate('text_1791490426177c2e83czhlg2')}
                value={mastercardPaymentProvider.merchantId ?? undefined}
              />
              <IntegrationsPage.DetailsItem
                icon="key"
                label={translate('text_1791490426177dq6kpao10g6')}
                value={mastercardPaymentProvider.apiPassword ?? undefined}
              />
              <IntegrationsPage.DetailsItem
                icon="globe"
                label={translate('text_1791490426178fwl1stxs56n')}
                value={getRegionLabel()}
              />
              <IntegrationsPage.DetailsItem
                icon="switch"
                label={translate('text_1791490426178qwfwopz6c3m')}
                value={translate(
                  mastercardPaymentProvider.testMode
                    ? 'text_1764160009979jzn4xunn1z8'
                    : 'text_176416000997957yqelmt2m2',
                )}
              />
              <IntegrationsPage.DetailsItem
                icon="key"
                label={translate('text_174987818899252mkql029wz')}
                value={mastercardPaymentProvider.webhookSecret ?? undefined}
              >
                {mastercardPaymentProvider.webhookSecret && (
                  <Tooltip title={translate('text_1727623127072q52kj0u3xql')} placement="top-end">
                    <Button
                      variant="quaternary"
                      onClick={() => {
                        copyToClipboard(mastercardPaymentProvider.webhookSecret as string)
                        addToast({
                          severity: 'info',
                          translateKey: 'text_1727623090069kyp9o88hpqf',
                        })
                      }}
                    >
                      <Icon name="duplicate" />
                    </Button>
                  </Tooltip>
                )}
              </IntegrationsPage.DetailsItem>
              <IntegrationsPage.DetailsItem
                icon="link"
                label={translate('text_6271200984178801ba8bdf22')}
                value={webhookUrl}
              >
                <Tooltip title={translate('text_1727623127072q52kj0u3xql')} placement="top-end">
                  <Button
                    variant="quaternary"
                    onClick={() => {
                      copyToClipboard(webhookUrl as string)
                      addToast({
                        severity: 'info',
                        translateKey: 'text_1727623090069kyp9o88hpqe',
                      })
                    }}
                  >
                    <Icon name="duplicate" />
                  </Button>
                </Tooltip>
              </IntegrationsPage.DetailsItem>

              <Typography
                className="mt-3"
                variant="caption"
                html={translate('text_17914904261782nlm7w8ywth')}
              />
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default MastercardIntegrationDetails
