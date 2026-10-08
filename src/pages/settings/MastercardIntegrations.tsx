import { gql } from '@apollo/client'
import { generatePath } from 'react-router'

import { Button } from '~/components/designSystem/Button'
import { Popper } from '~/components/designSystem/Popper'
import { Tooltip } from '~/components/designSystem/Tooltip'
import { IntegrationsPage } from '~/components/layouts/Integrations'
import { MainHeader } from '~/components/MainHeader/MainHeader'
import { useAddMastercardDialog } from '~/components/settings/integrations/AddMastercardDialog'
import { useDeleteMastercardIntegrationDialog } from '~/components/settings/integrations/DeleteMastercardIntegrationDialog'
import { IntegrationsTabsOptionsEnum } from '~/core/constants/tabsOptions'
import {
  INTEGRATIONS_ROUTE,
  MASTERCARD_INTEGRATION_DETAILS_ROUTE,
  useNavigate,
} from '~/core/router'
import {
  DeleteMastercardIntegrationDialogFragmentDoc,
  MastercardProvider,
  ProviderTypeEnum,
  useGetMastercardIntegrationsListQuery,
} from '~/generated/graphql'
import { useInternationalization } from '~/hooks/core/useInternationalization'
import { usePermissions } from '~/hooks/usePermissions'
import Mastercard from '~/public/images/mastercard.svg'
import { MenuPopper, PopperOpener } from '~/styles'

gql`
  fragment MastercardIntegrations on MastercardProvider {
    id
    name
    code
  }

  query getMastercardIntegrationsList($limit: Int, $type: ProviderTypeEnum) {
    paymentProviders(limit: $limit, type: $type) {
      collection {
        ... on MastercardProvider {
          id
          ...MastercardIntegrations
          ...DeleteMastercardIntegrationDialog
        }
      }
    }
  }

  ${DeleteMastercardIntegrationDialogFragmentDoc}
`

const MastercardIntegrations = () => {
  const navigate = useNavigate()
  const { translate } = useInternationalization()
  const { openAddMastercardDialog } = useAddMastercardDialog()
  const { openDeleteMastercardIntegrationDialog } = useDeleteMastercardIntegrationDialog()
  const { hasPermissions } = usePermissions()

  const { data, loading } = useGetMastercardIntegrationsListQuery({
    variables: { limit: 1000, type: ProviderTypeEnum.Mastercard },
  })
  const connections = data?.paymentProviders?.collection?.filter(
    (provider) => provider.__typename === 'MastercardProvider',
  ) as MastercardProvider[] | undefined
  const deleteDialogCallback =
    connections && connections.length === 1
      ? () =>
          navigate(
            generatePath(INTEGRATIONS_ROUTE, {
              integrationGroup: IntegrationsTabsOptionsEnum.Community,
            }),
          )
      : undefined

  const canCreateIntegration = hasPermissions(['organizationIntegrationsCreate'])
  const canEditIntegration = hasPermissions(['organizationIntegrationsUpdate'])
  const canDeleteIntegration = hasPermissions(['organizationIntegrationsDelete'])

  return (
    <>
      <MainHeader.Configure
        breadcrumb={[
          {
            label: translate('text_62b1edddbf5f461ab9712750'),
            path: generatePath(INTEGRATIONS_ROUTE, {
              integrationGroup: IntegrationsTabsOptionsEnum.Community,
            }),
          },
        ]}
        entity={{
          viewName: translate('text_1791490426176do7yw15mhfd'),
          viewNameLoading: loading,
          metadata: translate('text_62b1edddbf5f461ab971271f'),
          metadataLoading: loading,
          badges: [{ type: 'default', label: translate('text_634ea0ecc6147de10ddb662d') }],
          icon: <Mastercard />,
        }}
        actions={{
          items: [
            {
              type: 'action',
              label: translate('text_65846763e6140b469140e235'),
              variant: 'primary',
              hidden: !canCreateIntegration,
              onClick: () => {
                openAddMastercardDialog()
              },
            },
          ],
          loading,
        }}
      />

      <IntegrationsPage.Container>
        <section>
          <IntegrationsPage.Headline label={translate('text_65846763e6140b469140e239')} />

          {loading &&
            [1, 2].map((i) => <IntegrationsPage.ItemSkeleton key={`item-skeleton-item-${i}`} />)}

          {!loading &&
            connections?.map((connection, index) => {
              return (
                <IntegrationsPage.ListItem
                  key={`mastercard-connection-${index}`}
                  to={generatePath(MASTERCARD_INTEGRATION_DETAILS_ROUTE, {
                    integrationId: connection.id,
                    integrationGroup: IntegrationsTabsOptionsEnum.Community,
                  })}
                  label={connection.name}
                  subLabel={connection.code}
                >
                  {(canEditIntegration || canDeleteIntegration) && (
                    <Popper
                      PopperProps={{ placement: 'bottom-end' }}
                      opener={({ isOpen }) => (
                        <PopperOpener className="right-0 md:right-0">
                          <Tooltip
                            placement="top-end"
                            disableHoverListener={isOpen}
                            title={translate('text_626162c62f790600f850b7b6')}
                          >
                            <Button
                              icon="dots-horizontal"
                              variant="quaternary"
                              data-test="plan-item-options"
                            />
                          </Tooltip>
                        </PopperOpener>
                      )}
                    >
                      {({ closePopper }) => (
                        <MenuPopper>
                          {canEditIntegration && (
                            <Button
                              startIcon="pen"
                              variant="quaternary"
                              align="left"
                              onClick={() => {
                                openAddMastercardDialog({
                                  provider: connection,
                                  deleteCallback: deleteDialogCallback,
                                })
                                closePopper()
                              }}
                            >
                              {translate('text_65845f35d7d69c3ab4793dac')}
                            </Button>
                          )}

                          {canDeleteIntegration && (
                            <Button
                              startIcon="trash"
                              variant="quaternary"
                              align="left"
                              onClick={() => {
                                openDeleteMastercardIntegrationDialog({
                                  provider: connection,
                                  callback: deleteDialogCallback,
                                })
                                closePopper()
                              }}
                            >
                              {translate('text_65845f35d7d69c3ab4793dad')}
                            </Button>
                          )}
                        </MenuPopper>
                      )}
                    </Popper>
                  )}
                </IntegrationsPage.ListItem>
              )
            })}
        </section>
      </IntegrationsPage.Container>
    </>
  )
}

export default MastercardIntegrations
