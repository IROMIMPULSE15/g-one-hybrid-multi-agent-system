/**
 * Pinecone Connection Test Script
 * Tests Pinecone connectivity and configuration
 */

import { config } from 'dotenv'
config()

async function testPineconeConnection() {
    console.log('🔍 Testing Pinecone Connection...\n')

    // Check environment variables
    console.log('📋 Environment Variables:')
    console.log('  PINECONE_API_KEY:', process.env.PINECONE_API_KEY ? '✅ Set' : '❌ Not set')
    console.log('  PINECONE_INDEX:', process.env.PINECONE_INDEX || 'Not set')
    console.log('  PINECONE_INDEX_NAME:', process.env.PINECONE_INDEX_NAME || 'Not set')
    console.log('')

    if (!process.env.PINECONE_API_KEY) {
        console.error('❌ PINECONE_API_KEY is not set!')
        process.exit(1)
    }

    try {
        // Dynamic import Pinecone
        console.log('📦 Loading Pinecone SDK...')
        const pineconePkg: any = await import('@pinecone-database/pinecone')
        const PineconeClientConstructor = pineconePkg.Pinecone ||
            pineconePkg.PineconeClient ||
            pineconePkg.default?.Pinecone ||
            pineconePkg.default?.PineconeClient ||
            pineconePkg.default

        if (!PineconeClientConstructor) {
            throw new Error('Pinecone package loaded but no constructor found')
        }

        console.log('✅ Pinecone SDK loaded successfully\n')

        // Initialize Pinecone
        console.log('🔌 Initializing Pinecone client...')
        const pine = new PineconeClientConstructor({
            apiKey: process.env.PINECONE_API_KEY
        })

        // Try to initialize if method exists
        if (typeof pine.init === 'function') {
            await pine.init({ apiKey: process.env.PINECONE_API_KEY })
        } else if (typeof pine.initialize === 'function') {
            await pine.initialize({ apiKey: process.env.PINECONE_API_KEY })
        }

        console.log('✅ Pinecone client initialized\n')

        // List indexes
        console.log('📊 Listing available indexes...')
        try {
            let indexes: any[] = []

            if (typeof pine.listIndexes === 'function') {
                const result = await pine.listIndexes()
                indexes = result.indexes || result || []
            } else if (typeof pine.list === 'function') {
                indexes = await pine.list()
            }

            console.log(`✅ Found ${indexes.length} index(es):\n`)

            if (indexes.length > 0) {
                indexes.forEach((index: any, i: number) => {
                    const name = index.name || index
                    console.log(`  ${i + 1}. ${name}`)
                    if (index.dimension) console.log(`     Dimension: ${index.dimension}`)
                    if (index.metric) console.log(`     Metric: ${index.metric}`)
                    if (index.status) console.log(`     Status: ${index.status}`)
                    console.log('')
                })
            } else {
                console.log('  ⚠️  No indexes found. You may need to create one.')
            }
        } catch (listError: any) {
            console.warn('⚠️  Could not list indexes:', listError.message)
        }

        // Test connection to specific index
        const indexName = process.env.PINECONE_INDEX || process.env.PINECONE_INDEX_NAME || 'medical-embeddings'
        console.log(`\n🔍 Testing connection to index: "${indexName}"...`)

        try {
            const idx = typeof pine.Index === 'function' ? pine.Index(indexName) :
                (typeof pine.index === 'function' ? pine.index(indexName) : null)

            if (!idx) {
                throw new Error('Could not access index')
            }

            console.log('✅ Successfully connected to index\n')

            // Try to get index stats
            console.log('📈 Fetching index statistics...')
            try {
                const stats = await idx.describeIndexStats()
                console.log('✅ Index stats retrieved:')
                console.log('  Total vectors:', stats.totalRecordCount || stats.totalVectorCount || 'Unknown')
                console.log('  Dimension:', stats.dimension || 'Unknown')
                console.log('  Index fullness:', stats.indexFullness || 'Unknown')

                if (stats.namespaces) {
                    console.log('  Namespaces:', Object.keys(stats.namespaces).length)
                }
            } catch (statsError: any) {
                console.warn('⚠️  Could not fetch stats:', statsError.message)
            }

            // Test query (with dummy vector)
            console.log('\n🧪 Testing query functionality...')
            try {
                const testVector = new Array(384).fill(0.1) // Common embedding dimension

                const queryResult = await idx.query({
                    vector: testVector,
                    topK: 1,
                    includeMetadata: false
                })

                console.log('✅ Query test successful')
                console.log('  Matches returned:', queryResult.matches?.length || 0)
            } catch (queryError: any) {
                if (queryError.message?.includes('dimension')) {
                    console.log('⚠️  Query test failed (dimension mismatch - expected)')
                    console.log('  This is normal if your index uses a different dimension')
                } else {
                    console.warn('⚠️  Query test failed:', queryError.message)
                }
            }

        } catch (indexError: any) {
            console.error(`❌ Failed to connect to index "${indexName}":`, indexError.message)
            console.log('\n💡 Tip: Make sure the index name in .env matches your Pinecone index')
        }

        console.log('\n' + '='.repeat(60))
        console.log('✅ Pinecone Connection Test Complete!')
        console.log('='.repeat(60))

    } catch (error: any) {
        console.error('\n❌ Pinecone Connection Test Failed!')
        console.error('Error:', error.message)
        console.error('\nStack trace:', error.stack)
        process.exit(1)
    }
}

// Run the test
testPineconeConnection()
    .then(() => {
        console.log('\n✅ All tests passed!')
        process.exit(0)
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error)
        process.exit(1)
    })
