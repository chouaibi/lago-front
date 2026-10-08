import { cleanup, screen, waitFor } from '@testing-library/react'

import { ENTITY_SECTION_VIEW_NAME_TEST_ID } from '~/components/MainHeader/mainHeaderTestIds'
import { envGlobalVar } from '~/core/apolloClient'

import { renderIntegrationPage } from './integrationTestHelpers'

import MastercardIntegrationDetails from '../MastercardIntegrationDetails'

const REGION_LABEL_KEY = 'text_1791490426178fwl1stxs56n'
const EUROPE_REGION_KEY = 'text_1791490426178nsow70kpvw7'
const TEST_MODE_LABEL_KEY = 'text_1791490426178qwfwopz6c3m'
const YES_VALUE_KEY = 'text_1764160009979jzn4xunn1z8'

jest.mock('~/components/settings/integrations/AddMastercardDialog', () => ({
  useAddMastercardDialog: () => ({ openAddMastercardDialog: jest.fn() }),
}))
jest.mock('~/components/settings/integrations/DeleteMastercardIntegrationDialog', () => ({
  useDeleteMastercardIntegrationDialog: () => ({
    openDeleteMastercardIntegrationDialog: jest.fn(),
  }),
}))

jest.mock('~/hooks/core/useInternationalization', () => ({
  useInternationalization: () => ({ translate: (key: string) => key }),
}))

jest.mock('~/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ currentMembership: { organization: { id: 'current-org-id' } } }),
}))

jest.mock('~/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermissions: () => true }),
}))

const mockQueryResult = jest.fn()

jest.mock('~/generated/graphql', () => ({
  ...jest.requireActual('~/generated/graphql'),
  useMastercardIntegrationDetailsQuery: (...args: unknown[]) => mockQueryResult(...args),
}))

const buildQueryResult = () => ({
  data: {
    paymentProvider: {
      __typename: 'MastercardProvider',
      id: 'test-id',
      name: 'Test Integration',
      code: 'test-code',
      merchantId: '••••••••7890',
      apiPassword: '••••••••abcd',
      webhookSecret: 'webhook-secret',
      region: 'eu',
      testMode: true,
    },
    paymentProviders: { __typename: 'PaymentProviderCollection', collection: [] },
  },
  loading: false,
})

describe('MastercardIntegrationDetails', () => {
  afterEach(cleanup)

  describe('GIVEN the page is rendered with data', () => {
    beforeEach(() => {
      mockQueryResult.mockReturnValue(buildQueryResult())
    })

    it('THEN renders the integration name in the header', async () => {
      await renderIntegrationPage(MastercardIntegrationDetails, {
        useParams: { integrationId: 'test-id' },
      })

      await waitFor(() => {
        const viewName = screen.getAllByTestId(ENTITY_SECTION_VIEW_NAME_TEST_ID)

        expect(viewName[0]).toHaveTextContent('Test Integration')
      })
    })

    it('THEN builds the webhook URL from the current membership organization and the code', async () => {
      const { apiUrl } = envGlobalVar()

      await renderIntegrationPage(MastercardIntegrationDetails, {
        useParams: { integrationId: 'test-id' },
      })

      expect(
        screen.getByText(`${apiUrl}/webhooks/mastercard/current-org-id?code=test-code`),
      ).toBeInTheDocument()
    })

    it('THEN renders the region label and the test mode value', async () => {
      await renderIntegrationPage(MastercardIntegrationDetails, {
        useParams: { integrationId: 'test-id' },
      })

      expect(screen.getByText(REGION_LABEL_KEY).parentElement).toHaveTextContent(EUROPE_REGION_KEY)
      expect(screen.getByText(TEST_MODE_LABEL_KEY).parentElement).toHaveTextContent(YES_VALUE_KEY)
    })
  })

  describe('GIVEN the page is loading', () => {
    it('THEN renders the loading state', async () => {
      mockQueryResult.mockReturnValue({ data: undefined, loading: true })

      const { container } = await renderIntegrationPage(MastercardIntegrationDetails, {
        useParams: { integrationId: 'test-id' },
      })

      expect(screen.queryByText('Test Integration')).not.toBeInTheDocument()
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    })
  })
})
